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
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
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
      escapeCSV(tx.merchant || ''),
      tx.category || '',
      tx.bank || '',
      tx.balance || 0,
    ].join(','));
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
    const lines = csvString.trim().split(/\r?\n/);
    if (lines.length < 2) return null;
    const transactions = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 4) continue;
      const tx = {
        id: `csv-import-${i}-${Date.now()}`,
        date: parseImportDate(cols[0]),
        amount: parseFloat(cols[1]) || 0,
        type: cols[2] || 'Debit',
        merchant: cols[3] || 'Unknown',
        category: cols[4] || 'Others',
        bank: cols[5] || 'Unknown',
        balance: parseFloat(cols[6]) || 0,
      };
      if (validateTransaction(tx)) transactions.push(tx);
    }
    return transactions.length > 0 ? transactions : null;
  } catch {
    return null;
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function parseImportDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime()) && dateStr.includes('-')) return iso.toISOString();
  const m = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
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
