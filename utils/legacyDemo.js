// The former generator used these IDs exclusively. Gmail and CSV IDs use other prefixes.
export function removeLegacyDemoRows(transactions) {
  return transactions.filter((transaction) => !/^(?:sal-[0-2]|tx-\d+-\d{13})$/.test(transaction?.id));
}
