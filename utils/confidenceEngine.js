export function computeConfidence(tx) {
  let confidence = 0;
  const reasoning = [];

  // Merchant (0-0.30)
  if (tx.merchant && tx.merchant !== 'Unknown') {
    // We don't have direct access to matchType here, but we can guess based on string matching or we could pass matchType from the parser if available.
    // Given the prompt, we'll assume a recognized merchant is 0.30.
    confidence += 0.30;
    reasoning.push(`Merchant recognized: ${tx.merchant} (0.30)`);
  } else {
    reasoning.push(`Merchant missing or unknown (0.00)`);
  }

  // Amount (0-0.25)
  if (typeof tx.amount === 'number' && tx.amount > 0) {
    if (tx.amount > 500000 || tx.amount < 1) {
      confidence += 0.15;
      reasoning.push(`Amount valid but unusual: ₹${tx.amount} (0.15)`);
    } else {
      confidence += 0.25;
      reasoning.push(`Amount valid: ₹${tx.amount} (0.25)`);
    }
  } else {
    reasoning.push(`Amount missing or invalid (0.00)`);
  }

  // Balance (0-0.10)
  if (typeof tx.balance === 'number') {
    if (tx.balance > 0) {
      confidence += 0.10;
      reasoning.push(`Balance present and valid: ₹${tx.balance} (0.10)`);
    } else {
      confidence += 0.05;
      reasoning.push(`Balance present but zero (0.05)`);
    }
  } else {
    reasoning.push(`Balance missing (0.00)`);
  }

  // Date (0-0.15)
  if (tx.date) {
    const d = new Date(tx.date);
    if (!isNaN(d.getTime())) {
      const now = new Date();
      const daysOld = (now - d) / (1000 * 60 * 60 * 24);
      if (daysOld <= 365) {
        confidence += 0.15;
        reasoning.push(`Date valid and recent (0.15)`);
      } else {
        confidence += 0.08;
        reasoning.push(`Date valid but old (0.08)`);
      }
    } else {
      reasoning.push(`Date invalid (0.00)`);
    }
  } else {
    reasoning.push(`Date missing (0.00)`);
  }

  // Parser Certainty (0-0.10)
  if (tx.parsedBy && tx.parsedBy !== 'Unknown') {
    confidence += 0.10;
    reasoning.push(`Parsed by known bank parser: ${tx.parsedBy} (0.10)`);
  } else {
    confidence += 0.05;
    reasoning.push(`Parsed by generic parser (0.05)`);
  }

  // Pattern Quality (0-0.10)
  let patternQuality = 0.10;
  if (!tx.merchant || tx.merchant === 'Unknown') patternQuality -= 0.02;
  if (tx.balance === null || tx.balance === undefined) patternQuality -= 0.02;
  if (!tx.category || tx.category === 'Others') patternQuality -= 0.02;
  
  patternQuality = Math.max(0, patternQuality);
  confidence += patternQuality;
  reasoning.push(`Pattern quality score: ${patternQuality.toFixed(2)}`);

  // Cap at 1.0
  confidence = Math.min(1.0, confidence);

  let confidenceLevel = 'low';
  if (confidence >= 0.8) confidenceLevel = 'high';
  else if (confidence >= 0.5) confidenceLevel = 'medium';

  return { confidence, confidenceLevel, reasoning };
}
