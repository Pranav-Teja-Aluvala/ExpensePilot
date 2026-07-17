import { normalizeMerchant } from './merchantEngine.js';

export const CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills", "Entertainment",
  "Healthcare", "Salary", "Investment", "Transfer", "ATM", "Others", "Education", "Grocery", "Insurance", "Government"
];

export function categorize(merchant = "", type = "Debit") {
  if (type === "Credit") {
    const m = (merchant || "").toLowerCase();
    for (const kw of ["salary", "sal cr", "payroll"]) if (m.includes(kw)) return "Salary";
  }
  const result = normalizeMerchant(merchant);
  return result.category;
}
