const CSV_HEADERS = ['Date', 'Amount', 'Type', 'Merchant', 'Category', 'Bank', 'Balance'];

export function exportToJSON(transactions, settings) {
  const data = {
    version: '1.0',
    app: 'ExpensePilot',
    exportedAt: new Date().toISOString(),
    transactions: transactions || [],
    settings: settings || {},
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

export function exportToCSV(transactions) {
  const escapeCSV = (val) => {
    const str = String(val ?? '');
    if (str.trim() !== str || str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const lines = [CSV_HEADERS.join(',')];
  for (const tx of (transactions || [])) {
    lines.push([
      tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '',
      tx.amount || 0,
      tx.type || '',
      tx.merchant || '',
      tx.category || '',
      tx.bank || '',
      tx.balance || 0,
    ].map(escapeCSV).join(','));
  }
  return new Blob([lines.join('\n')], { type: 'text/csv' });
}

export function importFromJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') return null;
    const transactions = Array.isArray(data.transactions) ? data.transactions.filter(validateTransaction) : [];
    const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};
    return { transactions, settings };
  } catch {
    return null;
  }
}

export function importFromCSV(csvString) {
  try {
    const lines = parseCSVRecords(csvString.replace(/^\uFEFF/, ''));
    if (lines.length < 2) return null;
    const transactions = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i];
      if (cols.length < 4 || cols.length > CSV_HEADERS.length) continue;
      const amount = Number(cols[1]);
      const balance = Number(cols[6] || 0);
      if (!Number.isFinite(amount) || !Number.isFinite(balance)) continue;
      const tx = {
        id: `csv-import-${i}-${Date.now()}`,
        date: parseImportDate(cols[0]),
        amount,
        type: cols[2] || 'Debit',
        merchant: cols[3] || 'Unknown',
        category: cols[4] || 'Others',
        bank: cols[5] || 'Unknown',
        balance,
      };
      if (validateTransaction(tx)) transactions.push(tx);
    }
    return transactions.length > 0 ? transactions : null;
  } catch {
    return null;
  }
}

function parseCSVRecords(text) {
  const records = [];
  let row = [];
  let field = '';
  let quoted = false;
  let closed = false;
  function finishField() {
    row.push(closed ? field : field.trim());
    field = '';
    closed = false;
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (ch === ',') {
      finishField();
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      finishField();
      records.push(row);
      row = [];
    } else if (ch === '"' && !field && !closed) {
      quoted = true;
    } else if (ch === '"' || closed) {
      throw new Error('Unexpected character in quoted CSV field');
    } else {
      field += ch;
    }
  }
  if (quoted) throw new Error('Unclosed CSV field');
  finishField();
  records.push(row);
  return records;
}

function parseImportDate(value) {
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (!local && !iso) return null;
  const day = Number(local ? local[1] : iso[3]);
  const month = Number(local ? local[2] : iso[2]);
  let year = Number(local ? local[3] : iso[1]);
  if (local && local[3].length === 2) year += 2000;
  const calendar = new Date(year, month - 1, day);
  if (calendar.getFullYear() !== year || calendar.getMonth() !== month - 1 || calendar.getDate() !== day) return null;
  const date = local ? calendar : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function validateTransaction(tx) {
  if (!tx || typeof tx !== 'object') return false;
  if (!tx.amount || typeof tx.amount !== 'number' || tx.amount <= 0) return false;
  if (!tx.date) return false;
  const d = new Date(tx.date);
  if (isNaN(d.getTime())) return false;
  if (!tx.type || !['Credit', 'Debit'].includes(tx.type)) return false;
  return true;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
