// Mock transactions used until Gmail OAuth is wired.
import { categorize } from "./categorize.js";

const MERCHANTS = [
  { name: "Swiggy", type: "Debit", range: [180, 780] },
  { name: "Zomato", type: "Debit", range: [220, 950] },
  { name: "Uber", type: "Debit", range: [90, 620] },
  { name: "Ola", type: "Debit", range: [110, 540] },
  { name: "Amazon", type: "Debit", range: [299, 4599] },
  { name: "Flipkart", type: "Debit", range: [499, 6299] },
  { name: "Myntra", type: "Debit", range: [899, 3499] },
  { name: "Netflix", type: "Debit", range: [199, 799] },
  { name: "Spotify", type: "Debit", range: [119, 179] },
  { name: "Airtel Recharge", type: "Debit", range: [239, 999] },
  { name: "Jio Fiber", type: "Debit", range: [699, 1499] },
  { name: "BESCOM Electricity", type: "Debit", range: [900, 3200] },
  { name: "BPCL Fuel", type: "Debit", range: [500, 2500] },
  { name: "Apollo Pharmacy", type: "Debit", range: [180, 1200] },
  { name: "Zerodha", type: "Debit", range: [5000, 25000] },
  { name: "UPI Transfer to Rahul", type: "Debit", range: [200, 3000] },
  { name: "ATM Cash Withdrawal", type: "Debit", range: [2000, 10000] },
  { name: "Salary Credit", type: "Credit", range: [65000, 65000] },
  { name: "UPI Refund Amazon", type: "Credit", range: [299, 1499] },
];

const BANKS = ["HDFC", "ICICI", "SBI", "Axis", "Kotak"];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export function generateMockTransactions(count = 80) {
  const txs = [];
  const now = new Date();
  let balance = 84500;

  // Salary once a month
  for (let month = 0; month < 3; month++) {
    const d = new Date(now.getFullYear(), now.getMonth() - month, 1, 9, 30);
    balance += 65000;
    txs.push({
      id: `sal-${month}`,
      date: d.toISOString(),
      amount: 65000,
      type: "Credit",
      merchant: "Salary Credit",
      bank: "HDFC",
      balance,
      category: "Salary",
    });
  }

  for (let i = 0; i < count; i++) {
    const m = MERCHANTS[rand(0, MERCHANTS.length - 1)];
    const amt = rand(m.range[0], m.range[1]);
    const daysAgo = rand(0, 75);
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(rand(7, 22), rand(0, 59));
    balance += m.type === "Credit" ? amt : -amt;
    txs.push({
      id: `tx-${i}-${Date.now()}`,
      date: d.toISOString(),
      amount: amt,
      type: m.type,
      merchant: m.name,
      bank: BANKS[rand(0, BANKS.length - 1)],
      balance,
      category: categorize(m.name, m.type),
    });
  }
  return txs.sort((a, b) => new Date(b.date) - new Date(a.date));
}
