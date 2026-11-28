const entries = [
  ['2026-10-02', 'PAYROLL OCTOBER', '', 46500],
  ['2026-10-03', 'UPI/BLINKIT', 1485.50],
  ['2026-10-06', 'UPI/RAPIDO', 182],
  ['2026-10-09', 'NETFLIX', 649],
  ['2026-10-12', 'ELECTRICITY BILL', 1340],
  ['2026-10-16', 'UPI/ZOMATO', 782.30],
  ['2026-10-24', 'UPI/IRCTC', 1868],
  ['2026-10-26', 'OWN ACCOUNT TRANSFER', 7600],
  ['2026-11-02', 'PAYROLL NOVEMBER', '', 48500],
  ['2026-11-03', 'UPI/DMART', 2265.75],
  ['2026-11-04', 'UPI/RAPIDO', 182.50],
  ['2026-11-06', 'UPI/ZOMATO', 845],
  ['2026-11-08', 'UPI/BLINKIT', 1210.45],
  ['2026-11-09', 'NETFLIX', 649],
  ['2026-11-10', 'ELECTRICITY BILL', 1460.20],
  ['2026-11-11', 'UPI/IRCTC', 2240],
  ['2026-11-12', 'SHOPPING REFUND', '', 530.50],
  ['2026-11-14', 'UPI/AMAZON', 2120],
  ['2026-11-17', 'PERSONAL TRANSFER', 6400],
  ['2026-11-18', 'UPI/LOCAL COUNTER', 420],
  ['2026-11-20', 'UPI/ZOMATO', 685],
  ['2026-11-24', 'UPI/PHARMEASY', 720],
  ['2026-11-25', 'UPI/BLINKIT', 1280],
  ['2026-11-27', 'UPI/OLA', 376],
];

let balancePaise = 712_500;
const records = entries.map(([date, description, debit, credit = ''], index) => {
  balancePaise += Math.round(Number(credit) * 100) - Math.round(Number(debit) * 100);
  return [date, description, debit, credit, (balancePaise / 100).toFixed(2), `DEMO-${index + 1}`].join(',');
});

export const demoCsv = ['Date,Description,Debit,Credit,Balance,Reference', ...records].join('\n');
