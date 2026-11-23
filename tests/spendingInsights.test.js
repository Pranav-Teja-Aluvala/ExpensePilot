import assert from "node:assert/strict";
import test from "node:test";
import { compareMonthToDate, spendingInsights } from "../utils/spendingInsights.js";

const debit = (month, day, amount) => ({
  date: new Date(2026, month, day, 12).toISOString(),
  type: "Debit",
  category: "Transit",
  merchant: "Metro",
  amount,
});

test("compares the same days and excludes later transactions in both months", () => {
  const transactions = [debit(1, 2, 100), debit(2, 2, 50), debit(1, 23, 500), debit(2, 23, 900)];
  const today = new Date(2026, 2, 10);
  const comparison = compareMonthToDate(transactions, today);
  assert.equal(comparison.previous.spent, 100);
  assert.equal(comparison.current.spent, 50);
  assert.match(spendingInsights(transactions, today)[1].body, /-50%/);
});

test("uses the shorter month's last day as the shared cutoff", () => {
  const transactions = [debit(1, 28, 100), debit(2, 28, 50), debit(2, 29, 900)];
  const comparison = compareMonthToDate(transactions, new Date(2026, 2, 31));
  assert.deepEqual([comparison.day, comparison.current.spent, comparison.previous.spent], [28, 50, 100]);
});

test("shows an empty state and explains missing comparison data", () => {
  const today = new Date(2026, 2, 10);
  assert.equal(spendingInsights([], today)[0].title, "No transactions this month");
  assert.match(spendingInsights([debit(2, 4, 50)], today)[1].body, /no recorded debits/);
});
