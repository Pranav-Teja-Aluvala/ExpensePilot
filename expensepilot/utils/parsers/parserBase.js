export class ParserBase {
  constructor(bankName, senderPatterns) {
    this.bankName = bankName;
    this.senderPatterns = senderPatterns;
  }

  get name() { return this.bankName; }

  canParse(emailFrom, emailSubject) {
    const from = (emailFrom || '').toLowerCase();
    const subject = (emailSubject || '').toLowerCase();
    return this.senderPatterns.some(p => {
      const isRegex = p instanceof RegExp;
      return isRegex ? (p.test(from) || p.test(subject)) : (from.includes(p) || subject.includes(p));
    });
  }

  parse(emailBody, emailSubject, emailDate) {
    throw new Error('parse() must be implemented by subclass');
  }

  generateId(date, amount, merchant, type) {
    const raw = `${date}|${amount}|${merchant}|${type}|${this.bankName}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash |= 0;
    }
    return `${this.bankName.toLowerCase()}-${Math.abs(hash).toString(36)}`;
  }

  extractAmount(text) {
    const patterns = [
      /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi,
      /([\d,]+(?:\.\d{1,2})?)\s*(?:Rs\.?|INR|₹)/gi
    ];
    for (const p of patterns) {
      const m = p.exec(text);
      if (m) return this.normalizeAmount(m[1]);
    }
    return null;
  }

  extractBalance(text) {
    const patterns = [
      /(?:avl\.?\s*bal(?:ance)?|available\s*balance|bal)(?:\s*(?:is|:|-|=))?\s*(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi,
    ];
    for (const p of patterns) {
      const m = p.exec(text);
      if (m) return this.normalizeAmount(m[1]);
    }
    return null;
  }

  normalizeAmount(amountStr) {
    if (!amountStr) return null;
    const cleaned = String(amountStr).replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  stripHtml(html) {
    return (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  parseIndianDate(dateStr, fallbackDate) {
    if (!dateStr) return fallbackDate || new Date().toISOString();
    
    let m = dateStr.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    m = dateStr.match(/(\d{1,2})[\s-]?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s-]?(\d{2,4})/i);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = months[m[2].toLowerCase().slice(0,3)];
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    return fallbackDate || new Date().toISOString();
  }

  buildResult(date, amount, type, merchant, balance, rawSnippet, confidence, reasoning) {
    const id = this.generateId(date, amount, merchant, type);
    const level = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
    return {
      id,
      date,
      amount,
      type,
      merchant: merchant || 'Unknown',
      bank: this.bankName,
      balance,
      category: 'Others',
      rawSnippet: (rawSnippet || '').slice(0, 120),
      parsedBy: this.bankName,
      confidence,
      confidenceLevel: level,
      reasoning: reasoning || [],
    };
  }
}
