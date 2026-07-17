export function isDuplicate(newTx, existingTxs) {
  if (!newTx || !existingTxs || !Array.isArray(existingTxs)) return false;
  
  const newDate = new Date(newTx.date).getTime();
  
  return existingTxs.some(tx => {
    // Same ID
    if (tx.id === newTx.id) return true;
    
    // Same amount, type, bank, and date within 60 seconds
    if (tx.amount === newTx.amount && 
        tx.type === newTx.type && 
        tx.bank === newTx.bank) {
      const existingDate = new Date(tx.date).getTime();
      if (!isNaN(newDate) && !isNaN(existingDate) && Math.abs(newDate - existingDate) <= 60000) {
        return true;
      }
    }
    
    return false;
  });
}

export function deduplicateTransactions(txs) {
  if (!txs || !Array.isArray(txs)) return [];
  
  const result = [];
  const buckets = new Map();

  for (const tx of txs) {
    if (!tx || !tx.id) continue;
    // Fast path: if ID is already in result, skip.
    if (result.some(t => t.id === tx.id)) continue;

    const bucketKey = `${tx.amount}|${tx.type}|${tx.bank}`;
    let isDup = false;

    if (buckets.has(bucketKey)) {
      const bucket = buckets.get(bucketKey);
      const txTime = new Date(tx.date).getTime();
      for (const existingTx of bucket) {
        const extTime = new Date(existingTx.date).getTime();
        if (!isNaN(txTime) && !isNaN(extTime) && Math.abs(txTime - extTime) <= 60000) {
          isDup = true;
          break;
        }
      }
    } else {
      buckets.set(bucketKey, []);
    }

    if (!isDup) {
      result.push(tx);
      buckets.get(bucketKey).push(tx);
    }
  }

  return result;
}

export function findDuplicates(txs) {
  if (!txs || !Array.isArray(txs)) return { unique: [], duplicates: [] };
  
  const unique = [];
  const duplicates = [];
  
  txs.forEach(tx => {
    if (isDuplicate(tx, unique)) {
      duplicates.push(tx);
    } else {
      unique.push(tx);
    }
  });
  
  return { unique, duplicates };
}
