export class AnalyticsEngine {
  constructor(transactions = [], settings = {}) {
    this.txs = transactions;
    this.settings = settings;
  }

  _monthTxs(year, month) {
    return this.txs.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }

  _currentMonthTxs() {
    const now = new Date();
    return this._monthTxs(now.getFullYear(), now.getMonth());
  }

  _debits(txs) { return txs.filter(t => t.type === 'Debit'); }
  _credits(txs) { return txs.filter(t => t.type === 'Credit'); }
  _sum(txs) { return txs.reduce((s, t) => s + t.amount, 0); }

  getDailySpending(dateStr) {
    const key = new Date(dateStr).toISOString().slice(0, 10);
    return this._sum(this._debits(this.txs).filter(t => new Date(t.date).toISOString().slice(0, 10) === key));
  }

  getWeeklySpending(weekStartDate) {
    const start = new Date(weekStartDate);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const week = this._debits(this.txs).filter(t => {
      const d = new Date(t.date);
      return d >= start && d < end;
    });
    const daily = [0,0,0,0,0,0,0];
    week.forEach(t => { daily[(new Date(t.date).getDay() + 6) % 7] += t.amount; });
    const total = this._sum(week);
    return { total, daily, average: total / 7 };
  }

  getMonthlySpending(year, month) {
    const mtxs = this._monthTxs(year, month);
    const spent = this._sum(this._debits(mtxs));
    const income = this._sum(this._credits(mtxs));
    const savings = income - spent;
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
    return { spent, income, savings, savingsRate, count: mtxs.length };
  }

  getBudgetProgress() {
    const now = new Date();
    const mtxs = this._currentMonthTxs();
    const spent = this._sum(this._debits(mtxs));
    const budget = this.settings.monthlyBudget || 50000;
    const remaining = budget - spent;
    const percentUsed = budget > 0 ? Math.round((spent / budget) * 100) : 0;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const daysLeft = daysInMonth - dayOfMonth;
    const dailyRate = dayOfMonth > 0 ? spent / dayOfMonth : 0;
    const projectedTotal = Math.round(dailyRate * daysInMonth);
    const onTrack = projectedTotal <= budget;
    return { budget, spent, remaining, percentUsed, onTrack, projectedTotal, daysLeft };
  }

  getCategoryBreakdown(year, month) {
    const mtxs = year !== undefined ? this._monthTxs(year, month) : this.txs;
    const debits = this._debits(mtxs);
    const total = this._sum(debits);
    const map = new Map();
    debits.forEach(t => {
      const cur = map.get(t.category) || { amount: 0, count: 0 };
      cur.amount += t.amount;
      cur.count++;
      map.set(t.category, cur);
    });
    return [...map.entries()]
      .map(([category, { amount, count }]) => ({
        category, amount, count,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  getCategoryTrend(category, months = 6) {
    const now = new Date();
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mtxs = this._monthTxs(ref.getFullYear(), ref.getMonth());
      result.push(this._sum(this._debits(mtxs).filter(t => t.category === category)));
    }
    return result;
  }

  getTopMerchants(limit = 10, year, month) {
    const mtxs = year !== undefined ? this._monthTxs(year, month) : this.txs;
    const debits = this._debits(mtxs);
    const map = new Map();
    debits.forEach(t => {
      const cur = map.get(t.merchant) || { amount: 0, count: 0, category: t.category };
      cur.amount += t.amount;
      cur.count++;
      map.set(t.merchant, cur);
    });
    return [...map.entries()]
      .map(([merchant, data]) => ({ merchant, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  getRecurringMerchants() {
    const map = new Map();
    this._debits(this.txs).forEach(t => {
      const cur = map.get(t.merchant) || { dates: [], amounts: [] };
      cur.dates.push(new Date(t.date));
      cur.amounts.push(t.amount);
      map.set(t.merchant, cur);
    });
    return [...map.entries()]
      .filter(([, data]) => data.dates.length >= 2)
      .map(([merchant, data]) => {
        data.dates.sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < data.dates.length; i++) {
          gaps.push((data.dates[i] - data.dates[i-1]) / (1000 * 60 * 60 * 24));
        }
        const avgGap = gaps.length > 0 ? gaps.reduce((a,b) => a+b, 0) / gaps.length : 0;
        let frequency = 'occasional';
        if (avgGap <= 10) frequency = 'weekly';
        else if (avgGap <= 35) frequency = 'monthly';
        else if (avgGap <= 100) frequency = 'quarterly';
        const avgAmount = data.amounts.reduce((a,b) => a+b, 0) / data.amounts.length;
        return {
          merchant, frequency, count: data.dates.length,
          avgAmount: Math.round(avgAmount),
          lastDate: data.dates[data.dates.length - 1].toISOString(),
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  getLargestTransaction(year, month) {
    const mtxs = year !== undefined ? this._monthTxs(year, month) : this._currentMonthTxs();
    const debits = this._debits(mtxs);
    if (debits.length === 0) return null;
    return debits.reduce((max, t) => t.amount > max.amount ? t : max, debits[0]);
  }

  getMonthlyTrend(months = 6) {
    const now = new Date();
    const labels = [], spending = [], income = [];
    for (let i = months - 1; i >= 0; i--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(ref.toLocaleDateString('en-IN', { month: 'short' }));
      const mtxs = this._monthTxs(ref.getFullYear(), ref.getMonth());
      spending.push(this._sum(this._debits(mtxs)));
      income.push(this._sum(this._credits(mtxs)));
    }
    return { labels, spending, income };
  }

  getWeeklyBuckets() {
    const buckets = [0,0,0,0,0,0,0];
    this._debits(this._currentMonthTxs()).forEach(t => {
      buckets[(new Date(t.date).getDay() + 6) % 7] += t.amount;
    });
    return buckets;
  }

  getDailyHeatmap(days = 90) {
    const map = new Map();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    this._debits(this.txs).forEach(t => {
      const key = new Date(t.date).toISOString().slice(0, 10);
      if (map.has(key)) map.set(key, map.get(key) + t.amount);
    });
    return [...map.entries()];
  }

  getSpendingTrend() {
    const trend = this.getMonthlyTrend(3);
    if (trend.spending.length < 2) return 'stable';
    const last = trend.spending[trend.spending.length - 1];
    const prev = trend.spending[trend.spending.length - 2];
    if (prev === 0) return 'stable';
    const change = (last - prev) / prev;
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  getRollingAverage(days = 30) {
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - days);
    const recent = this._debits(this.txs).filter(t => new Date(t.date) >= start);
    return days > 0 ? Math.round(this._sum(recent) / days) : 0;
  }

  getForecastSpending() {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const mtxs = this._currentMonthTxs();
    const spent = this._sum(this._debits(mtxs));
    return dayOfMonth > 0 ? Math.round((spent / dayOfMonth) * daysInMonth) : 0;
  }

  getAverageDailySpend(days = 30) {
    return this.getRollingAverage(days);
  }

  getWeeklyReport() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    const weekTxs = this.txs.filter(t => {
      const d = new Date(t.date);
      return d >= weekStart && d <= weekEnd;
    });
    const totalSpent = this._sum(this._debits(weekTxs));
    const totalIncome = this._sum(this._credits(weekTxs));
    
    const prevStart = new Date(weekStart); prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(weekEnd); prevEnd.setDate(prevEnd.getDate() - 7);
    const prevTxs = this.txs.filter(t => {
      const d = new Date(t.date);
      return d >= prevStart && d <= prevEnd;
    });
    const prevSpent = this._sum(this._debits(prevTxs));
    const comparedToLastWeek = prevSpent > 0 ? Math.round(((totalSpent - prevSpent) / prevSpent) * 100) : 0;

    const cats = this.getCategoryBreakdown();
    const topMerchants = this.getTopMerchants(3);
    
    const dailyBreakdown = [0,0,0,0,0,0,0];
    this._debits(weekTxs).forEach(t => {
      dailyBreakdown[(new Date(t.date).getDay() + 6) % 7] += t.amount;
    });

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalSpent, totalIncome,
      topCategory: cats[0] || null,
      topMerchant: topMerchants[0] || null,
      dailyBreakdown,
      comparedToLastWeek,
    };
  }

  getMonthlyReport() {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const stats = this.getMonthlySpending(year, month);
    const categoryBreakdown = this.getCategoryBreakdown(year, month);
    const topMerchants = this.getTopMerchants(5, year, month);
    const trend = this.getSpendingTrend();
    const budgetStatus = this.getBudgetProgress();
    return {
      month: month + 1, year,
      ...stats,
      categoryBreakdown,
      topMerchants,
      trend,
      budgetStatus,
    };
  }

  getQuickSummary() {
    const now = new Date();
    const stats = this.getMonthlySpending(now.getFullYear(), now.getMonth());
    const largest = this.getLargestTransaction(now.getFullYear(), now.getMonth());
    return {
      spent: stats.spent,
      income: stats.income,
      savings: stats.savings,
      count: stats.count,
      largest,
    };
  }
}
