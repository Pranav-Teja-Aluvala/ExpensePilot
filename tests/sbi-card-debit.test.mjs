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

test('SBI card alert preserves a grouped rupee amount with paise', () => {
  const transaction = parseEmail(
    'alerts@sbi.co.in',
    fixture.subject,
    'Available balance: Rs. 20,000.00. Your card was debited Rs. 1,234.50 at CITY BOOKS.',
    '2026-11-23T00:00:00Z',
  );
  assert.ok(transaction);
  assert.equal(transaction.amount, 1234.5);
  assert.equal(transaction.merchant, 'CITY BOOKS');
});


test('SBI transfer uses the debit amount when the balance appears first', () => {
  const transaction = parseEmail(
    'alerts@sbi.co.in',
    fixture.subject,
    'Available balance: INR 12,450.00. Your account was debited for INR 850.00 on 23-11-2026 by ACME BOOKS.',
    '2026-11-23T00:00:00Z',
  );
  assert.ok(transaction);
  assert.equal(transaction.amount, 850);
  assert.equal(transaction.merchant, 'ACME BOOKS');
});
