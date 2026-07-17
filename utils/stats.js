import { AnalyticsEngine } from './analyticsEngine.js';

export function monthStats(txs, ref = new Date()) {
  const engine = new AnalyticsEngine(txs);
  const stats = engine.getMonthlySpending(ref.getFullYear(), ref.getMonth());
  const largest = engine.getLargestTransaction(ref.getFullYear(), ref.getMonth());
  return { 
    spent: stats.spent, 
    income: stats.income, 
    savings: stats.savings, 
    largest, 
    count: stats.count, 
    transactions: engine._monthTxs(ref.getFullYear(), ref.getMonth()) 
  };
}

export function byCategory(txs) {
  const engine = new AnalyticsEngine(txs);
  // getCategoryBreakdown returns [{category, amount, ...}]
  return engine.getCategoryBreakdown().map(c => [c.category, c.amount]);
}

export function weeklyBuckets(txs) {
  // Original implementation accumulated all txs Mon..Sun
  const buckets = [0, 0, 0, 0, 0, 0, 0];
  for (const t of txs) {
    if (t.type !== "Debit") continue;
    const d = new Date(t.date);
    const dow = (d.getDay() + 6) % 7;
    buckets[dow] += t.amount;
  }
  return buckets;
}

export function monthlyTrend(txs, months = 6) {
  const engine = new AnalyticsEngine(txs);
  const trend = engine.getMonthlyTrend(months);
  return { labels: trend.labels, spendVals: trend.spending, incomeVals: trend.income };
}

export function dailyHeatmap(txs, days = 90) {
  const engine = new AnalyticsEngine(txs);
  return engine.getDailyHeatmap(days);
}
