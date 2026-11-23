import { byCategory, monthStats } from "./stats.js";
import { inr } from "./format.js";

export function compareMonthToDate(transactions, today = new Date()) {
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const day = Math.min(today.getDate(), previousDays);
  const throughDay = transactions.filter((transaction) => new Date(transaction.date).getDate() <= day);

  return {
    day,
    current: monthStats(throughDay, today),
    previous: monthStats(throughDay, previousMonth),
  };
}

export function changeLabel(current, previous) {
  if (previous <= 0) return "No prior recorded amount";
  const percent = Math.round((current - previous) / previous * 100);
  if (percent === 0) return "About the same";
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

export function spendingInsights(transactions, today = new Date()) {
  const current = monthStats(transactions, today);
  if (!current.count) {
    return [{ icon: "◈", title: "No transactions this month", body: "Connect Gmail in Settings and scan bank alerts to see a breakdown." }];
  }

  const [top] = byCategory(current.transactions);
  const { day, current: comparable, previous } = compareMonthToDate(transactions, today);
  const cards = [];

  if (top && current.spent > 0) {
    cards.push({
      icon: "◈",
      title: `${top[0]} leads your spending`,
      body: `${inr(top[1])} this month, or ${Math.round(top[1] / current.spent * 100)}% of recorded debits.`,
    });
  }

  cards.push({
    icon: "▲",
    title: "Spending vs. the previous month",
    body: previous.spent > 0
      ? `Through day ${day}, recorded debits total ${inr(comparable.spent)} this month and ${inr(previous.spent)} last month (${changeLabel(comparable.spent, previous.spent)}).`
      : `There are no recorded debits through day ${day} of the previous month to compare against.`,
  });

  cards.push({
    icon: "≡",
    title: "Recorded cash flow",
    body: `${inr(current.income)} in credits and ${inr(current.spent)} in debits this month. Net recorded flow is ${inr(current.savings)}.`,
  });

  if (current.largest) {
    cards.push({
      icon: "✦",
      title: "Largest recorded expense",
      body: `${inr(current.largest.amount)} at ${current.largest.merchant || "an unknown merchant"}.`,
    });
  }

  return cards;
}
