import { demoCsv } from './demo.mjs';
import { openLedger, loadLedger, saveLedger } from './ledger-store.mjs';
import { categories, classifyDuplicates, kinds, MAX_FILE_BYTES, MAX_LEDGER_ROWS,
  normalizedLabel, readBackup, suggestClassification, validClassification } from './statement.mjs';

const $ = id => document.getElementById(id);
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const rupees = paise => money.format(paise / 100);
const monthLabel = month => monthFormat.format(new Date(`${month}-01T00:00:00Z`));
const dateLabel = date => dateFormat.format(new Date(`${date}T00:00:00Z`));
const signedAmount = row => `${row.direction === 'credit' ? '+' : '−'}${rupees(row.amountPaise)}`;
const pageSize = 30;
let database;
let ledger;
let preview;
let editing;
let page = 0;
let busy = false;

function element(tag, content = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = content;
  if (className) node.className = className;
  return node;
}

function setOptions(select, options, value = select.value) {
  select.replaceChildren(...options.map(([id, label]) => new Option(label, id)));
  if (options.some(([id]) => id === value)) select.value = value;
}

function showMessage(message, error = false) {
  const banner = $('message');
  banner.textContent = message;
  banner.dataset.error = String(error);
  banner.hidden = !message;
}

function renderControls() {
  $('review-button').disabled = busy;
  $('demo-button').disabled = busy;
  $('save-import').disabled = busy || !preview?.entries.some(entry => entry.include);
  $('cancel-preview').disabled = busy;
  $('download-backup').disabled = busy || !ledger?.transactions.length;
  $('restore-backup').disabled = busy || Boolean(ledger?.transactions.length);
  $('clear-ledger').disabled = busy || !ledger?.transactions.length;
}

async function run(action, refreshOnFailure = false) {
  if (busy || !database) return;
  busy = true;
  renderControls();
  showMessage('');
  try {
    await action();
  } catch (error) {
    if (refreshOnFailure) {
      try {
        ledger = await loadLedger(database);
        if (preview) setPreview(preview.statement, preview.account, preview.source);
        renderLedger();
      } catch { /* The original error is shown below. */ }
    }
    showMessage(error.message || 'Something went wrong. Please try again.', true);
    $('message').scrollIntoView({ block: 'nearest' });
  } finally {
    busy = false;
    renderControls();
  }
}

function parseFile(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./statement-worker.mjs', import.meta.url), { type: 'module' });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Reading the CSV took too long. Try a smaller file.'));
    }, 10_000);
    worker.onmessage = ({ data }) => {
      clearTimeout(timeout);
      worker.terminate();
      if (data.error) reject(new Error(data.error));
      else resolve(data);
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error('The statement reader could not start. Reload the page and try again.'));
    };
    worker.postMessage(file);
  });
}

function setPreview(statement, name, source) {
  const accountKey = normalizedLabel(name);
  const existing = ledger.transactions.filter(row => row.accountKey === accountKey);
  const account = existing[0]?.account ?? name;
  const alreadyImported = ledger.imports.some(item => item.accountKey === accountKey && item.fingerprint === statement.fingerprint);
  const statuses = alreadyImported ? statement.rows.map(() => 'duplicate') : classifyDuplicates(statement.rows, existing);
  const entries = statement.rows.map((row, index) => ({ row, status: statuses[index], include: statuses[index] === 'new' }));
  preview = { statement, entries, account, accountKey, source, alreadyImported };
  renderPreview();
}

function updatePreviewSelection() {
  const { statement, entries, alreadyImported } = preview;
  const selectedRows = entries.filter(entry => entry.include).map(entry => entry.row);
  const selected = selectedRows.length;
  $('preview-totals').textContent = `Statement · ${rupees(statement.totals.credit)} in · ${rupees(statement.totals.debit)} out · ${selected} of ${entries.length} valid rows selected`;
  const selectedAmounts = totals(selectedRows);
  $('selected-totals').hidden = selected === entries.length;
  $('selected-totals').textContent = `Selected · ${rupees(selectedAmounts.credit)} in · ${rupees(selectedAmounts.debit)} out`;
  $('save-import').textContent = alreadyImported ? 'Already imported' : `Add ${selected} ${selected === 1 ? 'transaction' : 'transactions'}`;
  renderControls();
}

function renderPreview() {
  $('preview').hidden = !preview;
  if (!preview) {
    $('preview-rows').replaceChildren();
    $('issue-list').replaceChildren();
    renderControls();
    return;
  }
  const { statement, entries, account, source, alreadyImported } = preview;
  const { rows, balanceChecks, balanceIssues, rejected } = statement;
  const dateRange = rows.length ? `${dateLabel(rows[0].date)} to ${dateLabel(rows.at(-1).date)}` : 'No valid dates';
  $('preview-period').textContent = `${account} · ${source} · ${dateRange}`;
  const balanceSummary = $('balance-summary');
  balanceSummary.dataset.error = String(Boolean(balanceIssues.length || rejected.length));
  if (alreadyImported) balanceSummary.textContent = 'This exact file has already been added to this account.';
  else if (balanceIssues.length) balanceSummary.textContent = `${balanceIssues.length} balance ${balanceIssues.length === 1 ? 'difference' : 'differences'}. Review these rows before saving.`;
  else if (rejected.length) balanceSummary.textContent = 'Some records were rejected. Balance checks restart after each rejected record.';
  else if (balanceChecks) balanceSummary.textContent = `${balanceChecks} balance checks matched the reported balances.`;
  else balanceSummary.textContent = 'At least two reported balances are needed to check the running totals.';

  $('import-issues').hidden = !rejected.length && !balanceIssues.length;
  $('import-issues').open = Boolean(rejected.length || balanceIssues.length);
  $('issue-summary').textContent = `${rejected.length} rejected · ${balanceIssues.length} balance differences`;
  $('issue-list').replaceChildren(
    ...rejected.map(item => element('li', `Record ${item.sourceRow}: ${item.reason}`)),
    ...balanceIssues.map(item => element('li', `Record ${item.sourceRow}: expected ${rupees(item.expected)}, reported ${rupees(item.reported)}`))
  );
  $('preview-rows').replaceChildren(...entries.map(entry => {
    const { row, status } = entry;
    const line = element('tr');
    const description = element('td', row.description);
    description.append(element('small', `Record ${row.sourceRow}${row.reference ? ` · ${row.reference}` : ''}`, 'source'));
    const statusCell = element('td');
    if (status === 'possible') {
      const label = element('label', '', 'check');
      const input = element('input');
      input.type = 'checkbox';
      input.checked = entry.include;
      input.addEventListener('change', () => {
        entry.include = input.checked;
        updatePreviewSelection();
      });
      label.append(input, document.createTextNode('Include possible duplicate'));
      statusCell.append(label);
    } else {
      const classification = suggestClassification(row, ledger.rules);
      statusCell.textContent = status === 'duplicate' ? 'Already recorded' : classification.kind;
      if (status === 'new') statusCell.append(element('small', classification.reason, 'source'));
    }
    line.append(element('td', dateLabel(row.date)), description,
      element('td', signedAmount(row), row.direction === 'credit' ? 'amount credit' : 'amount'), statusCell);
    return line;
  }));
  if (!entries.length) addEmptyRow($('preview-rows'), 'No valid rows to add. Open the issue list for details.');
  updatePreviewSelection();
}

async function reviewFile(file, account, source) {
  if (!account || !normalizedLabel(account)) throw new Error('Enter an account nickname.');
  if (!file || file.size > MAX_FILE_BYTES) throw new Error('Choose a CSV file no larger than 2 MiB.');
  if (!source.toLowerCase().endsWith('.csv')) throw new Error('Choose a .csv file.');
  const statement = await parseFile(file);
  ledger = await loadLedger(database);
  setPreview(statement, account, source.slice(0, 255));
  $('preview-title').focus();
}

async function addStatement() {
  if (!preview) return;
  const { entries, account, accountKey, source, statement } = preview;
  const added = entries.filter(entry => entry.include).map(({ row }) => ({
    ...row, ...suggestClassification(row, ledger.rules), id: crypto.randomUUID(), account, accountKey, source,
  }));
  if (!added.length) return;
  if (ledger.transactions.length + added.length > MAX_LEDGER_ROWS) throw new Error('This ledger holds up to 20,000 transactions.');
  ledger = await saveLedger(database, ledger.revision, {
    transactions: [...ledger.transactions, ...added],
    imports: [...ledger.imports, { accountKey, fingerprint: statement.fingerprint }],
  });
  preview = null;
  renderPreview();
  $('statement-file').value = '';
  $('search-filter').value = '';
  page = 0;
  renderLedger(accountKey, added.at(-1).date.slice(0, 7), '');
  showMessage(`Added ${added.length} ${added.length === 1 ? 'transaction' : 'transactions'} to ${account}.`);
  $('overview-title').focus({ preventScroll: true });
  $('overview-title').scrollIntoView({ block: 'nearest' });
}

function totals(rows) {
  return rows.reduce((sum, row) => {
    sum[row.direction] += row.amountPaise;
    if (row.kind === 'Spending') sum.spending += row.amountPaise;
    return sum;
  }, { debit: 0, credit: 0, spending: 0 });
}

function bar(value, maximum) {
  const progress = element('progress');
  progress.value = value;
  progress.max = maximum || 1;
  progress.setAttribute('aria-hidden', 'true');
  return progress;
}

function showTransactions() {
  $('transaction-title').focus({ preventScroll: true });
  $('transactions').scrollIntoView({ block: 'start' });
}

function renderCategories(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (row.kind === 'Spending') grouped.set(row.category, (grouped.get(row.category) ?? 0) + row.amountPaise);
  }
  const values = [...grouped].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  $('category-chart').replaceChildren(...values.map(([category, total]) => {
    const button = element('button', '', 'bar-row');
    button.type = 'button';
    button.append(element('span', category), bar(total, values[0][1]), element('strong', rupees(total)));
    button.addEventListener('click', () => {
      page = 0;
      $('search-filter').value = '';
      renderLedger(undefined, undefined, category);
      showTransactions();
    });
    return button;
  }));
  if (!values.length) $('category-chart').append(element('p', 'No debits are marked as spending in this period.', 'empty'));
}

function renderTrend(rows, lastMonth) {
  const chart = $('trend-chart');
  if (!lastMonth) {
    chart.replaceChildren(element('p', 'Import a statement to see monthly cash flow.', 'empty'));
    return;
  }
  const [year, month] = lastMonth.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, index) => new Date(Date.UTC(year, month - 6 + index, 1)).toISOString().slice(0, 7));
  const values = months.map(key => ({ key, ...totals(rows.filter(row => row.date.startsWith(key))) }));
  const maximum = Math.max(...values.map(item => Math.max(item.credit, item.debit)));
  chart.replaceChildren(...values.map(({ key, credit, debit }) => {
    const button = element('button', '', 'trend-row');
    button.type = 'button';
    button.disabled = !credit && !debit;
    button.setAttribute('aria-label', `${monthLabel(key)}: ${rupees(credit)} in, ${rupees(debit)} out, ${rupees(credit - debit)} net movement`);
    button.title = button.getAttribute('aria-label');
    const bars = element('span', '', 'trend-bars');
    bars.append(bar(credit, maximum), bar(debit, maximum));
    button.append(element('span', monthLabel(key)), bars, element('strong', rupees(credit - debit)));
    button.addEventListener('click', () => {
      page = 0;
      $('search-filter').value = '';
      renderLedger(undefined, key, '');
    });
    return button;
  }));
}

function addEmptyRow(body, message) {
  const row = element('tr');
  const cell = element('td', message, 'empty');
  cell.colSpan = 4;
  row.append(cell);
  body.append(row);
}

function renderRows(rows, category) {
  const search = normalizedLabel($('search-filter').value);
  const filtered = rows.filter(row => (!category || (row.kind === 'Spending' && row.category === category)) &&
    (!search || normalizedLabel(`${row.description} ${row.reference}`).includes(search)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.sourceRow - a.sourceRow);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, pages - 1);
  $('transaction-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'transaction' : 'transactions'}${category ? ` · ${category}` : ''}`;
  $('ledger-rows').replaceChildren(...filtered.slice(page * pageSize, (page + 1) * pageSize).map(row => {
    const tr = element('tr');
    const description = element('td', row.description);
    description.append(element('small', `${row.account}${row.reference ? ` · ${row.reference}` : ''}`, 'source'));
    const classification = element('td');
    const label = row.kind === 'Spending' ? row.category : row.kind;
    const edit = element('button', label, 'text-button');
    edit.type = 'button';
    edit.setAttribute('aria-label', `Edit classification for ${row.description}: ${label}`);
    edit.addEventListener('click', () => openEditor(row));
    classification.append(edit, element('small', row.reason, 'source'));
    tr.append(element('td', dateLabel(row.date)), description, classification,
      element('td', signedAmount(row), row.direction === 'credit' ? 'amount credit' : 'amount'));
    return tr;
  }));
  if (!filtered.length) addEmptyRow($('ledger-rows'), ledger.transactions.length ? 'No matching transactions.' : 'Import a statement or try the demo to get started.');
  $('pager').hidden = pages < 2;
  $('page-status').textContent = `Page ${page + 1} of ${pages}`;
  $('previous').disabled = page === 0;
  $('next').disabled = page === pages - 1;
}

function renderLedger(account = $('account-filter').value, month = $('month-filter').value, category = $('category-filter').value) {
  const accounts = [...new Map(ledger.transactions.map(row => [row.accountKey, row.account]))].sort((a, b) => a[1].localeCompare(b[1]));
  setOptions($('account-filter'), [['', 'All accounts'], ...accounts], account);
  const accountRows = ledger.transactions.filter(row => !$('account-filter').value || row.accountKey === $('account-filter').value);
  const months = [...new Set(accountRows.map(row => row.date.slice(0, 7)))].sort().reverse();
  setOptions($('month-filter'), [['', 'All months'], ...months.map(key => [key, monthLabel(key)])], month);
  const visibleRows = accountRows.filter(row => !$('month-filter').value || row.date.startsWith($('month-filter').value));
  const usedCategories = [...new Set(visibleRows.filter(row => row.kind === 'Spending').map(row => row.category))].sort();
  setOptions($('category-filter'), [['', 'All transactions'], ...usedCategories.map(key => [key, key])], category);

  const { debit, credit, spending } = totals(visibleRows);
  $('inflow').textContent = rupees(credit);
  $('outflow').textContent = rupees(debit);
  $('net').textContent = rupees(credit - debit);
  $('spending').textContent = rupees(spending);
  renderCategories(visibleRows);
  renderTrend(accountRows, $('month-filter').value || months[0]);
  renderRows(visibleRows, $('category-filter').value);
  renderControls();
}

function openEditor(row) {
  if (busy) return;
  editing = row;
  $('edit-description').textContent = `${row.description} · ${signedAmount(row)}`;
  $('edit-source').textContent = `${row.source} · record ${row.sourceRow}`;
  const supported = kinds.filter(kind => validClassification(row.direction, kind, 'Uncategorized'));
  setOptions($('edit-kind'), supported.map(kind => [kind, kind]), row.kind);
  setOptions($('edit-category'), categories.map(category => [category, category]), row.category);
  $('edit-category').disabled = row.kind !== 'Spending';
  $('remember-rule').checked = false;
  $('edit-dialog').showModal();
}

async function saveEdit() {
  if (!editing) return;
  const kind = $('edit-kind').value;
  const category = kind === 'Spending' ? $('edit-category').value : 'Uncategorized';
  const { id, direction, description } = editing;
  if (!validClassification(direction, kind, category)) throw new Error('Choose a valid classification.');
  const transactions = ledger.transactions.map(row => row.id === id ? { ...row, kind, category, reason: 'Edited by you' } : row);
  let rules = ledger.rules;
  if ($('remember-rule').checked) {
    const normalized = normalizedLabel(description);
    rules = [...rules.filter(rule => rule.description !== normalized || rule.direction !== direction),
      { description: normalized, direction, kind, category }];
  }
  $('edit-dialog').close();
  ledger = await saveLedger(database, ledger.revision, { transactions, rules });
  if (preview) renderPreview();
  renderLedger();
}

function download(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = element('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setListeners() {
  $('import-form').addEventListener('submit', event => {
    event.preventDefault();
    const file = $('statement-file').files[0];
    run(() => reviewFile(file, $('account-name').value.trim(), file?.name ?? ''));
  });
  $('demo-button').addEventListener('click', () => run(() => reviewFile(new Blob([demoCsv]), 'Demo account', 'expensepilot-demo.csv')));
  $('template-button').addEventListener('click', () => download(demoCsv, 'text/csv', 'expensepilot-demo.csv'));
  $('cancel-preview').addEventListener('click', () => {
    preview = null;
    renderPreview();
    $('review-button').focus();
  });
  $('save-import').addEventListener('click', () => run(addStatement, true));
  for (const id of ['account-filter', 'month-filter', 'category-filter', 'search-filter']) {
    $(id).addEventListener(id === 'search-filter' ? 'input' : 'change', () => {
      page = 0;
      renderLedger();
    });
  }
  $('previous').addEventListener('click', () => { page--; renderLedger(); });
  $('next').addEventListener('click', () => { page++; renderLedger(); });
  $('close-editor').addEventListener('click', () => $('edit-dialog').close());
  $('edit-kind').addEventListener('change', () => { $('edit-category').disabled = $('edit-kind').value !== 'Spending'; });
  $('edit-form').addEventListener('submit', event => { event.preventDefault(); run(saveEdit, true); });
  $('download-backup').addEventListener('click', () => {
    const { transactions, imports, rules } = ledger;
    download(JSON.stringify({ format: 'ExpensePilot ledger', version: 1, transactions, imports, rules }),
      'application/json', `expensepilot-${new Date().toISOString().slice(0, 10)}.json`);
  });
  $('restore-backup').addEventListener('change', event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    run(async () => {
      if (ledger.transactions.length) throw new Error('Restore requires an empty ledger.');
      if (file.size > 32 * 1024 * 1024) throw new Error('Choose a backup under 32 MiB.');
      const backup = readBackup(await file.text());
      ledger = await saveLedger(database, ledger.revision, backup);
      preview = null;
      renderPreview();
      renderLedger('', ledger.transactions.map(row => row.date.slice(0, 7)).sort().at(-1) ?? '', '');
      showMessage(`Restored ${ledger.transactions.length} transactions.`);
    }, true);
  });
  $('clear-ledger').addEventListener('click', () => {
    if (!confirm('Clear all transactions and saved rules from this browser?')) return;
    run(async () => {
      ledger = await saveLedger(database, ledger.revision, { transactions: [], imports: [], rules: [] });
      preview = null;
      renderPreview();
      renderLedger('', '', '');
      showMessage('Local ledger cleared.');
    }, true);
  });
}

try {
  database = await openLedger();
  ledger = await loadLedger(database);
  setListeners();
  const latest = ledger.transactions.reduce((month, row) => row.date.slice(0, 7) > month ? row.date.slice(0, 7) : month, '');
  renderLedger('', latest, '');
} catch {
  $('review-button').disabled = true;
  $('demo-button').disabled = true;
  $('download-backup').disabled = true;
  $('restore-backup').disabled = true;
  $('clear-ledger').disabled = true;
  showMessage('Browser storage could not be opened. Open ExpensePilot on localhost or HTTPS with storage enabled.', true);
}
