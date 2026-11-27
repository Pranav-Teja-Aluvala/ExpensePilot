import assert from 'node:assert/strict';
import test from 'node:test';

for (const prefix of ['..', '../expensepilot']) {
  const { exportToCSV, importFromCSV } = await import(prefix + '/utils/exportImport.js');
  test(prefix + ' CSV preserves quoted fields across transaction boundaries', async () => {
    const fields = { amount: 14.25, type: 'Debit', date: '2026-11-20', balance: 200,
      merchant: 'Book\r\nStore', category: 'Books, stationery', bank: 'A "Bank"' };
    const next = { ...fields, merchant: 'Corner shop' };
    const csv = await exportToCSV([fields, next]).text();
    const rows = importFromCSV(csv);
    assert.equal(rows.length, 2);
    for (const [index, expected] of [fields, next].entries()) {
      for (const key of ['merchant', 'category', 'bank', 'amount', 'type', 'balance']) {
        assert.equal(rows[index][key], expected[key]);
      }
    }
  });
}
