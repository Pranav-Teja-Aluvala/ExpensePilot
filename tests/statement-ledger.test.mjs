import assert from 'node:assert/strict';
import test from 'node:test';
import { demoCsv } from '../web/demo.mjs';
import { classifyDuplicates, parseStatement, readBackup, suggestClassification } from '../web/statement.mjs';

const header = 'Date,Description,Debit,Credit,Balance,Reference';
const csv = (...rows) => [header, ...rows].join('\n');

test('the demo reconciles its reported balances and preserves paise', () => {
  const statement = parseStatement(demoCsv);
  assert.equal(statement.rows.length, 24);
  assert.equal(statement.balanceChecks, 23);
  assert.deepEqual(statement.rejected, []);
  assert.deepEqual(statement.balanceIssues, []);
  assert.deepEqual(statement.totals, { credit: 9_553_050, debit: 3_476_070 });
  assert.equal(statement.rows[1].amountPaise, 148_550);
});

test('CSV preserves quoted descriptions and rejects invalid dates and ambiguous amounts', () => {
  const statement = parseStatement('\ufeff' + csv(
    '01/11/2026,"Shop, A","1,25,000.05",,"-1,25,000.05",R1',
    '31/11/2026,Impossible date,1,,,R2',
    '2026-11-03,Too many decimals,12.001,,,R3',
    '2026-11-04,Extra decimal,12.1.2,,,R4',
    '2026-11-05,Both directions,12,2,,R5',
    '2026-11-06,Refund,,25,-124975.05,R6'
  ));
  assert.deepEqual(statement.rejected.map(row => row.sourceRow), [3, 4, 5, 6]);
  assert.deepEqual(statement.totals, { debit: 12_500_005, credit: 2_500 });
  assert.equal(statement.rows[0].date, '2026-11-01');
  assert.equal(statement.rows[0].description, 'Shop, A');
  assert.equal(statement.rows[0].balancePaise, -12_500_005);
  assert.equal(statement.balanceChecks, 0);
});

test('a balance difference identifies the record and the expected amount', () => {
  const result = parseStatement(csv('2026-11-01,Start,,200,250,', '2026-11-02,Debit,14,,230,'));
  assert.deepEqual(result.balanceIssues, [{ sourceRow: 3, expected: 23_600, reported: 23_000 }]);
  assert.throws(() => parseStatement(csv('2026-11-02,Start,,200,250,', '2026-11-01,Debit,14,,230,')), /oldest to newest/);
  assert.throws(() => parseStatement('Date,Narration,Value\n2026-11-01,Transfer,5'), /Expected Date/);
});

test('overlap respects reference evidence and preserves ambiguous repeated payments', () => {
  const [saved, similar, differentRef] = parseStatement(csv(
    '2026-11-01,Rapido,91.11,,100,R1', '2026-11-01,Rapido,91.11,,,', '2026-11-01,Rapido,91.11,,,R2'
  )).rows;
  assert.deepEqual(classifyDuplicates([saved, similar, differentRef], [saved]), ['duplicate', 'possible', 'new']);
  assert.deepEqual(classifyDuplicates([saved, saved], [saved]), ['possible', 'possible']);
  assert.deepEqual(classifyDuplicates([similar, similar], []), ['new', 'new']);
});

test('rules, known merchants, refunds and unclassified UPI have distinct results', () => {
  const [merchant, refund, transfer, unknown] = parseStatement(csv(
    '2026-11-01,UPI/BLINKIT,20,,40,', '2026-11-02,Order refund,,6,46,',
    '2026-11-03,Own account transfer,3,,43,', '2026-11-04,UPI/UNKNOWN,2,,41,'
  )).rows;
  assert.equal(suggestClassification(merchant, []).category, 'Groceries');
  assert.equal(suggestClassification(refund, []).kind, 'Refund');
  assert.equal(suggestClassification(transfer, []).kind, 'Transfer');
  assert.equal(suggestClassification(unknown, []).kind, 'Unclassified');
  assert.equal(suggestClassification(merchant, [{ description: 'upi/blinkit', direction: 'debit',
    kind: 'Spending', category: 'Shopping' }]).category, 'Shopping');
});

test('backup restores supported records and rejects invalid classifications', () => {
  const row = parseStatement(csv('2026-11-01,Rapido,91.11,,100,R1')).rows[0];
  const tx = { ...row, ...suggestClassification(row, []), id: 'id-1',
    account: 'Demo', accountKey: 'demo', source: 'example.csv' };
  const backup = { format: 'ExpensePilot ledger', version: 1, transactions: [tx], imports: [], rules: [] };
  assert.deepEqual(readBackup(JSON.stringify(backup)).transactions, [tx]);
  assert.throws(() => readBackup(JSON.stringify({ ...backup, transactions: [{ ...tx, kind: 'Income' }] })), /invalid ledger/);
});
