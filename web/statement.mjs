import { parseCSVRecords } from '../utils/exportImport.js';
import { getMerchantDictionary } from '../utils/merchantEngine.js';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_STATEMENT_ROWS = 2_000;
export const MAX_LEDGER_ROWS = 20_000;
const MAX_PAISE = 100_000_000_000;
const requiredHeaders = ['date', 'description', 'debit', 'credit'];
const allowedHeaders = [...requiredHeaders, 'balance', 'reference'];
const merchants = getMerchantDictionary();
const categoryNames = { Food: 'Dining', Grocery: 'Groceries' };
const groceryMerchants = new Set(['Blinkit', 'Zepto']);
export const kinds = ['Unclassified', 'Spending', 'Income', 'Transfer', 'Refund'];
export const categories = ['Uncategorized', ...new Set([...merchants.values()].map(item =>
  groceryMerchants.has(item.canonical) ? 'Groceries' : categoryNames[item.category] ?? item.category
))].sort();

function parseDate(value) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const dayFirst = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/.exec(value);
  if (!iso && !dayFirst) return null;
  const [year, month, day] = (iso ? iso.slice(1) : [dayFirst[4], dayFirst[3], dayFirst[1]]).map(Number);
  if (year < 1900 || year > 2099) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function parsePaise(value, allowNegative = false) {
  if (value === '') return null;
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction, ...extraParts] = unsigned.split('.');
  const grouping = /^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3})$/;
  if ((negative && !allowNegative) || !grouping.test(whole) || extraParts.length ||
      (fraction !== undefined && !/^\d{1,2}$/.test(fraction))) {
    throw new Error('Use an amount with up to two decimal places. Quote amounts containing commas.');
  }
  const amount = Number(whole.replaceAll(',', '')) * 100 + Number((fraction ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > MAX_PAISE) throw new Error('Amount is outside the supported range.');
  return negative ? -amount : amount;
}

function parseRow(row, headers, sourceRow) {
  if (row.length !== headers.length) throw new Error('Column count differs from the header.');
  const record = Object.fromEntries(headers.map((header, index) => [header, row[index].trim()]));
  const date = parseDate(record.date);
  if (!date) throw new Error('Invalid date. Use YYYY-MM-DD or DD/MM/YYYY.');
  if (!record.description || record.description.length > 500) throw new Error('Description must contain 1–500 characters.');
  const debit = parsePaise(record.debit) ?? 0;
  const credit = parsePaise(record.credit) ?? 0;
  if ((debit > 0) === (credit > 0)) throw new Error('Enter one positive debit or credit.');
  const balancePaise = parsePaise(record.balance ?? '', true);
  const reference = record.reference ?? '';
  if (reference.length > 120) throw new Error('Reference exceeds 120 characters.');
  return { date, description: record.description, direction: debit ? 'debit' : 'credit',
    amountPaise: debit || credit, balancePaise, reference, sourceRow };
}

export function parseStatement(text) {
  const source = parseCSVRecords(text.replace(/^\uFEFF/, ''));
  const records = source.map((row, index) => ({ row, number: index + 1 }))
    .filter(({ row }) => row.some(value => value.trim()));
  const header = records.shift();
  if (!header) throw new Error('The CSV is empty.');
  const headers = header.row.map(value => value.trim().toLowerCase());
  if (new Set(headers).size !== headers.length || requiredHeaders.some(name => !headers.includes(name)) ||
      headers.some(name => !allowedHeaders.includes(name))) {
    throw new Error('Expected Date, Description, Debit and Credit headers, with optional Balance and Reference.');
  }
  if (records.length > MAX_STATEMENT_ROWS) throw new Error(`Import up to ${MAX_STATEMENT_ROWS} records at a time.`);

  const rows = [];
  const rejected = [];
  const balanceIssues = [];
  let previousDate = '';
  let previousBalance = null;
  let balanceChecks = 0;
  let movement = 0;

  for (const { row, number } of records) {
    let transaction;
    try {
      transaction = parseRow(row, headers, number);
    } catch (error) {
      rejected.push({ sourceRow: number, reason: error.message });
      previousBalance = null;
      movement = 0;
      continue;
    }
    if (transaction.date < previousDate) throw new Error('Sort the statement from oldest to newest, then try again.');
    previousDate = transaction.date;
    rows.push(transaction);
    movement += transaction.direction === 'credit' ? transaction.amountPaise : -transaction.amountPaise;
    if (transaction.balancePaise === null) continue;
    if (previousBalance !== null) {
      balanceChecks++;
      const expected = previousBalance + movement;
      if (expected !== transaction.balancePaise) {
        balanceIssues.push({ sourceRow: number, expected, reported: transaction.balancePaise });
      }
    }
    previousBalance = transaction.balancePaise;
    movement = 0;
  }

  const totals = rows.reduce((result, row) => {
    result[row.direction] += row.amountPaise;
    return result;
  }, { debit: 0, credit: 0 });
  return { rows, rejected, balanceIssues, balanceChecks, totals };
}

export function normalizedLabel(value) {
  return value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function suggestClassification(row, rules) {
  const description = normalizedLabel(row.description);
  const rule = rules.find(item => item.description === description && item.direction === row.direction);
  if (rule) return { kind: rule.kind, category: rule.category, reason: 'Your saved rule' };
  const defaultClassification = { category: 'Uncategorized' };
  if (/\b(?:self transfer|own account|personal transfer)\b/.test(description)) {
    return { ...defaultClassification, kind: 'Transfer', reason: 'Explicit transfer wording' };
  }
  if (row.direction === 'credit') {
    if (/\b(?:refund|reversal)\b/.test(description)) return { ...defaultClassification, kind: 'Refund', reason: 'Refund or reversal wording' };
    if (/\b(?:salary|payroll)\b/.test(description)) return { ...defaultClassification, kind: 'Income', reason: 'Salary or payroll wording' };
  } else {
    const segments = description.split(/[/@:|]|\s+-\s+/).map(value => value.trim());
    const merchant = segments.map(value => merchants.get(value)).find(Boolean);
    if (merchant) {
      const category = groceryMerchants.has(merchant.canonical) ? 'Groceries' : categoryNames[merchant.category] ?? merchant.category;
      return { kind: 'Spending', category, reason: `Matched ${merchant.canonical}` };
    }
    if (/\belectricity\b/.test(description)) return { kind: 'Spending', category: 'Bills', reason: 'Electricity in the description' };
  }
  return { ...defaultClassification, kind: 'Unclassified', reason: 'Needs a category review' };
}

export function validClassification(direction, kind, category) {
  if (!kinds.includes(kind) || !categories.includes(category)) return false;
  if (kind === 'Spending' && direction !== 'debit') return false;
  if ((kind === 'Income' || kind === 'Refund') && direction !== 'credit') return false;
  return kind === 'Spending' || category === 'Uncategorized';
}

export function classifyDuplicates(rows, existing) {
  const sameRef = row => JSON.stringify([row.date, row.direction, row.amountPaise, normalizedLabel(row.reference)]);
  const sameDetails = row => JSON.stringify([row.date, row.direction, row.amountPaise, normalizedLabel(row.description)]);
  const countKeys = (items, key) => {
    const result = new Map();
    for (const item of items) {
      const value = key(item);
      result.set(value, (result.get(value) ?? 0) + 1);
    }
    return result;
  };
  const savedRefs = countKeys(existing.filter(row => row.reference), sameRef);
  const incomingRefs = countKeys(rows.filter(row => row.reference), sameRef);
  const allDetails = countKeys(existing, sameDetails);
  const noRefDetails = countKeys(existing.filter(row => !row.reference), sameDetails);
  return rows.map(row => {
    const ref = row.reference ? sameRef(row) : null;
    if (ref && savedRefs.has(ref)) {
      return (savedRefs.get(ref) === 1 && incomingRefs.get(ref) === 1) ? 'duplicate' : 'possible';
    }
    const details = row.reference ? noRefDetails : allDetails;
    return details.has(sameDetails(row)) ? 'possible' : 'new';
  });
}

export function readBackup(text) {
  const backup = JSON.parse(text);
  const { transactions, imports, rules } = backup ?? {};
  if (backup?.format !== 'ExpensePilot ledger' || backup.version !== 1 || !Array.isArray(transactions) ||
      !Array.isArray(imports) || !Array.isArray(rules) || transactions.length > MAX_LEDGER_ROWS ||
      imports.length > MAX_LEDGER_ROWS || rules.length > MAX_LEDGER_ROWS) {
    throw new Error('Choose an ExpensePilot ledger backup.');
  }
  const lengthBetween = (value, min, max) => typeof value === 'string' && value.length >= min && value.length <= max;
  const directions = ['debit', 'credit'];
  const safeAmount = value => Number.isSafeInteger(value) && Math.abs(value) <= MAX_PAISE;
  const unique = (items, key) => new Set(items.map(item => item[key])).size === items.length;
  const validAccount = (key, label) => lengthBetween(label, 1, 60) && normalizedLabel(label) === key && key !== '';
  if (!transactions.every(row => row && lengthBetween(row.id, 1, 100) && validAccount(row.accountKey, row.account) &&
      typeof row.date === 'string' && parseDate(row.date) === row.date && lengthBetween(row.description, 1, 500) &&
      directions.includes(row.direction) && safeAmount(row.amountPaise) && row.amountPaise > 0 &&
      (row.balancePaise === null || safeAmount(row.balancePaise)) && lengthBetween(row.reference, 0, 120) &&
      lengthBetween(row.source, 1, 255) && Number.isSafeInteger(row.sourceRow) && row.sourceRow > 0 &&
      validClassification(row.direction, row.kind, row.category) && lengthBetween(row.reason, 1, 150)) ||
      !imports.every(item => item && lengthBetween(item.accountKey, 1, 240) && /^[a-f0-9]{64}$/.test(item.fingerprint)) ||
      !rules.every(rule => rule && lengthBetween(rule.description, 1, 2_000) && directions.includes(rule.direction) &&
        validClassification(rule.direction, rule.kind, rule.category)) || !unique(transactions, 'id')) {
    throw new Error('The backup contains invalid ledger records.');
  }
  return { transactions, imports, rules };
}
