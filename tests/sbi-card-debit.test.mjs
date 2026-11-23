import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseEmail } from '../utils/parsers/registry.js';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/balance-before-debit.json', import.meta.url),
  'utf8',
));

test('SBI card alert extracts the debit amount and merchant', () => {
  const transaction = parseEmail(
    'alerts@sbi.co.in', fixture.subject, fixture.body, '2026-11-23T00:00:00Z',
  );
  assert.ok(transaction);
  assert.equal(transaction.amount, fixture.expected.amount);
  assert.equal(transaction.merchant, fixture.expected.merchant);
});

test('an unrecognized sender does not trigger the SBI parser', () => {
  const transaction = parseEmail(
    'alerts@example.com', fixture.subject, fixture.body, '2026-11-23T00:00:00Z',
  );
  assert.equal(transaction, null);
});
