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
  
  const map = new Map();
  
  txs.forEach(tx => {
    const date = new Date(tx.date).getTime();
    // Create a key that buckets the time into 60-second intervals for the same amount, type, and bank
    const timeBucket = Math.floor(date / 60000);
    const key = `${tx.amount}|${tx.type}|${tx.bank}|${timeBucket}`;
    
    // Priority to keeping existing ones or just use the Map
    if (!map.has(tx.id) && !map.has(key)) {
      map.set(tx.id, tx); // Primary deduplication by ID
      map.set(key, tx);   // Secondary deduplication by similarity
    }
  });
  
  // Return unique values based on ID to avoid returning duplicate objects from the two set() calls
  const uniqueTxs = new Map();
  map.forEach(tx => uniqueTxs.set(tx.id, tx));
  
  return Array.from(uniqueTxs.values());
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
