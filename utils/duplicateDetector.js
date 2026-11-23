export function isDuplicate(transaction, existingTransactions) {
  return Boolean(transaction?.id && Array.isArray(existingTransactions) &&
    existingTransactions.some((existing) => existing?.id === transaction.id));
}

export function findDuplicates(transactions) {
  const unique = [];
  const duplicates = [];
  const seen = new Set();

  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    if (!transaction?.id) continue;
    if (seen.has(transaction.id)) {
      duplicates.push(transaction);
    } else {
      seen.add(transaction.id);
      unique.push(transaction);
    }
  }

  return { unique, duplicates };
}

export function deduplicateTransactions(transactions) {
  return findDuplicates(transactions).unique;
}

export function mergeGmailTransactions(existingTransactions, incomingTransactions) {
  const merged = deduplicateTransactions(existingTransactions);
  const legacyRows = new Map();
  const seenMessages = new Set();

  merged.forEach((transaction, index) => {
    if (transaction.gmailMessageId) {
      seenMessages.add(transaction.gmailMessageId);
    } else {
      legacyRows.set(transaction.id, index);
    }
  });

  for (const transaction of incomingTransactions) {
    const messageId = transaction.gmailMessageId;
    if (!messageId || seenMessages.has(messageId)) continue;
    seenMessages.add(messageId);

    const legacyIndex = legacyRows.get(transaction.id);
    if (legacyIndex !== undefined) {
      // Keep existing category edits and other persisted fields during a rescan.
      merged[legacyIndex] = { ...merged[legacyIndex], gmailMessageId: messageId };
      legacyRows.delete(transaction.id);
    } else {
      merged.push({ ...transaction, id: `gmail:${messageId}` });
    }
  }

  return merged;
}
