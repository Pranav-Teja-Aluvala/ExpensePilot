function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

const DICTIONARY = [
  { canonical: 'Swiggy', category: 'Food', aliases: ['SWGY', 'swiggy.in'] },
  { canonical: 'Zomato', category: 'Food', aliases: ['ZMTO', 'zomato.com'] },
  { canonical: 'Dominos', category: 'Food', aliases: ['DOMINO'] },
  { canonical: 'McDonalds', category: 'Food', aliases: ['MCD', 'MCDONALDS'] },
  { canonical: 'KFC', category: 'Food', aliases: [] },
  { canonical: 'Starbucks', category: 'Food', aliases: ['SBUX'] },
  { canonical: 'Pizza Hut', category: 'Food', aliases: [] },
  { canonical: 'Burger King', category: 'Food', aliases: ['BK'] },
  { canonical: 'Subway', category: 'Food', aliases: [] },
  { canonical: 'Dunkin Donuts', category: 'Food', aliases: [] },
  { canonical: 'Chaayos', category: 'Food', aliases: [] },
  { canonical: 'Blinkit', category: 'Food', aliases: ['BLNKT'] },
  { canonical: 'Zepto', category: 'Food', aliases: [] },
  { canonical: 'BigBasket', category: 'Grocery', aliases: ['BB', 'BIGBASKET'] },
  { canonical: 'JioMart', category: 'Grocery', aliases: [] },
  { canonical: 'DMart', category: 'Grocery', aliases: ['DMART'] },
  
  { canonical: 'Uber', category: 'Transport', aliases: ['UBER INDIA', 'UBER TRIP'] },
  { canonical: 'Ola', category: 'Transport', aliases: ['OLA CABS', 'OLACABS'] },
  { canonical: 'Rapido', category: 'Transport', aliases: [] },
  { canonical: 'IRCTC', category: 'Transport', aliases: ['irctc.co.in'] },
  { canonical: 'Metro', category: 'Transport', aliases: [] },
  { canonical: 'BPCL', category: 'Transport', aliases: ['BHARAT PETROLEUM'] },
  { canonical: 'HP', category: 'Transport', aliases: ['HINDUSTAN PETROLEUM', 'HPCL'] },
  { canonical: 'IndianOil', category: 'Transport', aliases: ['IOCL', 'IOC'] },
  { canonical: 'FastTag', category: 'Transport', aliases: ['FASTAG', 'FASTag'] },
  { canonical: 'Bounce', category: 'Transport', aliases: [] },
  { canonical: 'Yulu', category: 'Transport', aliases: [] },

  { canonical: 'Amazon', category: 'Shopping', aliases: ['AMZN', 'AMZ', 'AMAZON PAY', 'AMAZON.IN', 'APay'] },
  { canonical: 'Flipkart', category: 'Shopping', aliases: ['FLPKRT', 'FK'] },
  { canonical: 'Myntra', category: 'Shopping', aliases: ['MNTRA'] },
  { canonical: 'Ajio', category: 'Shopping', aliases: ['AJIO.COM'] },
  { canonical: 'Nykaa', category: 'Shopping', aliases: ['NYKAA.COM'] },
  { canonical: 'Meesho', category: 'Shopping', aliases: [] },
  { canonical: 'TataCliq', category: 'Shopping', aliases: [] },
  { canonical: 'Croma', category: 'Shopping', aliases: [] },
  { canonical: 'Reliance Digital', category: 'Shopping', aliases: ['RELIANCE', 'RELI'] },
  { canonical: 'Snapdeal', category: 'Shopping', aliases: [] },
  { canonical: 'FirstCry', category: 'Shopping', aliases: ['FRSTCRY'] },
  { canonical: 'Lenskart', category: 'Shopping', aliases: [] },

  { canonical: 'Airtel', category: 'Bills', aliases: ['BHARTI AIRTEL'] },
  { canonical: 'Jio', category: 'Bills', aliases: ['RELIANCE JIO', 'JIO FIBER'] },
  { canonical: 'Vodafone', category: 'Bills', aliases: ['VI', 'VODAFONE IDEA'] },
  { canonical: 'BESCOM', category: 'Bills', aliases: [] },
  { canonical: 'BSES', category: 'Bills', aliases: [] },
  { canonical: 'Tata Power', category: 'Bills', aliases: [] },
  { canonical: 'Mahanagar Gas', category: 'Bills', aliases: ['MGL'] },
  { canonical: 'IGL', category: 'Bills', aliases: [] },
  { canonical: 'Hathway', category: 'Bills', aliases: [] },
  { canonical: 'ACT Fibernet', category: 'Bills', aliases: ['ACT'] },

  { canonical: 'Netflix', category: 'Entertainment', aliases: ['NFLX'] },
  { canonical: 'Spotify', category: 'Entertainment', aliases: [] },
  { canonical: 'Disney+ Hotstar', category: 'Entertainment', aliases: ['HOTSTAR', 'DISNEY'] },
  { canonical: 'Prime Video', category: 'Entertainment', aliases: ['PRIME', 'AMAZON PRIME'] },
  { canonical: 'BookMyShow', category: 'Entertainment', aliases: ['BMS', 'BOOKMYSHOW'] },
  { canonical: 'YouTube Premium', category: 'Entertainment', aliases: ['YOUTUBE', 'GOOGLE YOUTUBE'] },
  { canonical: 'SonyLIV', category: 'Entertainment', aliases: [] },
  { canonical: 'Zee5', category: 'Entertainment', aliases: ['ZEE'] },
  { canonical: 'JioCinema', category: 'Entertainment', aliases: [] },

  { canonical: 'Apollo', category: 'Healthcare', aliases: ['APOLLO PHARMACY', 'APOLLO HOSPITALS'] },
  { canonical: 'PharmEasy', category: 'Healthcare', aliases: ['PHARMEASY'] },
  { canonical: '1mg', category: 'Healthcare', aliases: ['ONEMG', '1MG'] },
  { canonical: 'MedPlus', category: 'Healthcare', aliases: [] },
  { canonical: 'Practo', category: 'Healthcare', aliases: [] },
  { canonical: 'Netmeds', category: 'Healthcare', aliases: [] },
  { canonical: 'Lybrate', category: 'Healthcare', aliases: [] },

  { canonical: 'Zerodha', category: 'Investment', aliases: ['ZERODHA BROKING'] },
  { canonical: 'Groww', category: 'Investment', aliases: [] },
  { canonical: 'Upstox', category: 'Investment', aliases: [] },
  { canonical: 'Kuvera', category: 'Investment', aliases: [] },
  { canonical: 'ICICI Direct', category: 'Investment', aliases: ['ICICIDIRECT'] },
  { canonical: 'Angel One', category: 'Investment', aliases: ['ANGELONE', 'ANGEL BROKING'] },
  { canonical: 'Paytm Money', category: 'Investment', aliases: [] },
  { canonical: 'ET Money', category: 'Investment', aliases: [] },
  { canonical: 'Coin', category: 'Investment', aliases: ['COIN ZERODHA'] },

  { canonical: 'Unacademy', category: 'Education', aliases: [] },
  { canonical: 'BYJUS', category: 'Education', aliases: ['BYJU\'S'] },
  { canonical: 'Coursera', category: 'Education', aliases: [] },
  { canonical: 'Udemy', category: 'Education', aliases: [] },
  { canonical: 'Vedantu', category: 'Education', aliases: [] },
  { canonical: 'Toppr', category: 'Education', aliases: [] },

  { canonical: 'HDFC Life', category: 'Insurance', aliases: [] },
  { canonical: 'ICICI Prudential', category: 'Insurance', aliases: ['ICICI PRU'] },
  { canonical: 'LIC', category: 'Insurance', aliases: ['LIFE INSURANCE'] },
  { canonical: 'Max Life', category: 'Insurance', aliases: [] },
  { canonical: 'SBI Life', category: 'Insurance', aliases: [] },
  { canonical: 'Star Health', category: 'Insurance', aliases: [] },

  { canonical: 'Income Tax', category: 'Government', aliases: ['INCOMETAX', 'IT DEPT'] },
  { canonical: 'GST', category: 'Government', aliases: ['GSTIN'] },
  { canonical: 'Passport Seva', category: 'Government', aliases: [] }
];

export function getMerchantDictionary() {
  const map = new Map();
  DICTIONARY.forEach(item => {
    map.set(item.canonical.toLowerCase(), { canonical: item.canonical, category: item.category });
    item.aliases.forEach(alias => {
      map.set(alias.toLowerCase(), { canonical: item.canonical, category: item.category });
    });
  });
  return map;
}

const merchantMap = getMerchantDictionary();

export function addMerchantAlias(alias, canonical) {
  const existing = Array.from(merchantMap.values()).find(v => v.canonical.toLowerCase() === canonical.toLowerCase());
  if (existing) {
    merchantMap.set(alias.toLowerCase(), { canonical: existing.canonical, category: existing.category });
  } else {
    merchantMap.set(alias.toLowerCase(), { canonical, category: 'Others' });
  }
}

export function extractMerchantFromUPI(vpa) {
  if (!vpa || typeof vpa !== 'string') return null;
  const parts = vpa.split('@');
  if (parts.length === 2) {
    return parts[0].replace(/[^a-zA-Z0-9]/g, ' ').trim();
  }
  return null;
}

export function normalizeMerchant(rawMerchant) {
  if (!rawMerchant) return { canonical: 'Unknown', category: 'Others', confidence: 0, matchType: 'none' };
  
  let cleaned = rawMerchant.replace(/[^a-zA-Z0-9\s@\.]/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = cleaned.toLowerCase();

  // 1. Exact or Alias match
  if (merchantMap.has(lower)) {
    const match = merchantMap.get(lower);
    return { canonical: match.canonical, category: match.category, confidence: 1.0, matchType: 'exact' };
  }

  // 2. UPI VPA extraction
  if (lower.includes('@')) {
    const vpaExtracted = extractMerchantFromUPI(lower);
    if (vpaExtracted && merchantMap.has(vpaExtracted)) {
      const match = merchantMap.get(vpaExtracted);
      return { canonical: match.canonical, category: match.category, confidence: 0.85, matchType: 'upi' };
    }
  }

  // 3. Partial match
  for (const [key, val] of merchantMap.entries()) {
    if (key.length > 3 && lower.includes(key)) {
      return { canonical: val.canonical, category: val.category, confidence: 0.75, matchType: 'partial' };
    }
  }

  // 4. Fuzzy match
  let bestMatch = null;
  let bestScore = Infinity;
  for (const [key, val] of merchantMap.entries()) {
    if (Math.abs(key.length - lower.length) > 3) continue;
    const score = levenshtein(lower, key);
    const threshold = key.length <= 6 ? 2 : 3;
    if (score <= threshold && score < bestScore) {
      bestScore = score;
      bestMatch = val;
    }
  }
  
  if (bestMatch) {
    return { canonical: bestMatch.canonical, category: bestMatch.category, confidence: 0.6, matchType: 'fuzzy' };
  }

  // 5. Keyword fallback category
  const fallbackKeywords = {
    'Food': ['swiggy', 'zomato', 'dominos', 'mcdonald', 'kfc', 'starbucks', 'cafe', 'restaurant', 'eatsure', 'blinkit', 'zepto'],
    'Transport': ['uber', 'ola', 'rapido', 'irctc', 'metro', 'petrol', 'bpcl', 'hp fuel', 'indianoil', 'fastag'],
    'Shopping': ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'tatacliq', 'croma', 'reliance retail'],
    'Bills': ['airtel', 'jio', 'vodafone', 'bescom', 'electricity', 'gas', 'water', 'recharge', 'broadband', 'tata power'],
    'Entertainment': ['netflix', 'spotify', 'prime video', 'hotstar', 'bookmyshow', 'youtube', 'disney'],
    'Healthcare': ['apollo', 'pharmeasy', '1mg', 'medplus', 'hospital', 'clinic', 'diagnostic'],
    'Salary': ['salary', 'sal cr', 'payroll', 'wages'],
    'Investment': ['zerodha', 'groww', 'mutual fund', 'sip', 'upstox', 'kuvera', 'icici direct'],
    'Transfer': ['upi', 'imps', 'neft', 'rtgs', 'transfer to', 'sent to'],
    'ATM': ['atm', 'cash withdrawal', 'cash wdl']
  };

  for (const [cat, keywords] of Object.entries(fallbackKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return { canonical: cleaned, category: cat, confidence: 0.4, matchType: 'keyword' };
    }
  }

  return { canonical: cleaned, category: 'Others', confidence: 0.2, matchType: 'fallback' };
}
