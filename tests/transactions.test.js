import assert from "node:assert/strict";
import test from "node:test";
import { parseEmail } from "../utils/parsers/registry.js";
import { deduplicateTransactions, mergeGmailTransactions } from "../utils/duplicateDetector.js";

const receivedAt = "2026-11-23T10:15:00.000Z";
const examples = [
  ["SBI", "alerts@sbi.co.in", "Avl Bal INR 5000. Account debited for Rs. 1,234.50 on 22-Nov-2026 by Cafe.", 1234.5, "Debit", "Cafe"],
  ["HDFC", "alerts@hdfcbank.net", "<p>INR&nbsp;80.25 debited on 22/11/2026 to Metro.</p>", 80.25, "Debit", "Metro"],
  ["ICICI", "alerts@icicibank.com", "Credited Rs 12,34,567.89 on 22Nov2026; Payroll.", 1234567.89, "Credit", "Payroll"],
  ["Axis", "alerts@axisbank.com", "Debited with INR 250 on 22-11-26 towards Books.", 250, "Debit", "Books"],
  ["Kotak", "alerts@kotak.com", "INR 99 has been debited towards Groceries on 22/11/2026.", 99, "Debit", "Groceries"],
  ["Union Bank", "alerts@unionbankofindia.co.in", "Credited Rs. 500 on 22-11-2026. Refund.", 500, "Credit", "Refund"],
];

for (const [bank, from, body, amount, type, merchant] of examples) {
  test(`parses a synthetic ${bank} alert`, () => {
    const transaction = parseEmail(from, "Transaction alert", body, receivedAt);
    assert.ok(transaction);
    assert.deepEqual(
      [transaction.bank, transaction.amount, transaction.type, transaction.merchant, transaction.date],
      [bank, amount, type, merchant, "2026-11-22T06:30:00.000Z"],
    );
    assert.equal(parseEmail(from, "Transaction alert", body, receivedAt).id, transaction.id);
  });
}

test("rejects malformed alerts and ignores unrelated mail", () => {
  for (const body of [null, 123, "", "Balance INR 100", "Debited INR 12,34", "Debited INR 12.345", "Debited INR 0"]) {
    assert.equal(parseEmail("alerts@sbi.co.in", "", body, receivedAt), null);
  }
  assert.equal(parseEmail("news@example.test", "", "Debited INR 12", receivedAt), null);
});

test("uses the email date when the alert gives an impossible calendar date", () => {
  const transaction = parseEmail("alerts@hdfcbank.net", "", "INR 80 debited on 31-02-2026 to Metro.", receivedAt);
  assert.equal(transaction.date, receivedAt);
});

test("keeps separate Gmail alerts for identical purchases and ignores repeated imports", () => {
  const [, from, body] = examples[1];
  const parsed = parseEmail(from, "", body, receivedAt);
  const first = { ...parsed, gmailMessageId: "message-1" };
  const second = { ...parsed, gmailMessageId: "message-2" };
  const merged = mergeGmailTransactions([], [first, first, second]);
  assert.deepEqual(merged.map(({ id }) => id), ["gmail:message-1", "gmail:message-2"]);
  assert.deepEqual(mergeGmailTransactions(merged, [second, first]), merged);
});

test("reconciles one legacy row without overwriting user edits", () => {
  const [, from, body] = examples[1];
  const parsed = parseEmail(from, "", body, receivedAt);
  const edited = { ...parsed, category: "My commute" };
  const merged = mergeGmailTransactions([edited], [
    { ...parsed, gmailMessageId: "message-1" },
    { ...parsed, gmailMessageId: "message-2" },
  ]);
  assert.deepEqual(merged[0], { ...edited, gmailMessageId: "message-1" });
  assert.equal(merged[1].id, "gmail:message-2");
  assert.deepEqual(deduplicateTransactions([edited, edited]), [edited]);
});
