import { test } from 'node:test';
import assert from 'node:assert/strict';
const header = 'Date,Amount,Type,Merchant,Category,Bank,Balance';
for (const prefix of ['..', '../expensepilot']) {
  const { exportToCSV, importFromCSV } = await import(prefix + '/utils/exportImport.js');
  const read = row => importFromCSV(header + '\r\n' + row);
  test(prefix + ' handles BOM, blank records, optional fields and every newline', () => {
    for (const newline of ['\r', '\n', '\r\n']) {
      const rows = importFromCSV('\ufeff' + [header, '', '03-04-26,12,Debit,,,,', ''].join(newline));
      assert.equal(rows.length, 1);
      const date = new Date(rows[0].date);
      assert.deepEqual([date.getDate(), date.getMonth()+1], [3,4]);
      assert.deepEqual([rows[0].merchant, rows[0].category, rows[0].bank, rows[0].balance], ['Unknown','Others','Unknown',0]);
    }
  });
  test(prefix + ' preserves merchant punctuation and significant whitespace', async () => {
    const merchant = '  Shop, "A"\rFloor 2  ';
    const csv = await exportToCSV([{date:'2026-04-03',amount:1,type:'Debit',merchant}]).text();
    assert.equal(importFromCSV(csv)[0].merchant, merchant);
  });
  test(prefix + ' rejects ambiguous quoting and corrupt financial rows', () => {
    for (const row of ['1/1/26,1,Debit,"unterminated\n2/1/26,2,Debit,Shop',
      '1/1/26,1,Debit,"shop"x', '31/02/26,1,Debit,x', ',1,Debit,x',
      '1/1/26,12x,Debit,x', '1/1/26,Infinity,Debit,x', '1/1/26,1,Debit,x,c,b,abc',
      '1/1/26,1,Debit,x,c,b,0,extra', '', 'short,row']) assert.equal(read(row),null);
  });
}
