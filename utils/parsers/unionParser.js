import { ParserBase } from './parserBase.js';

export class UnionParser extends ParserBase {
  constructor() {
    super('Union Bank', [/alerts?@unionbankofindia\.co\.in/i, /union\s*bank/i]);
  }

  parse(emailBody, emailSubject, emailDate) {
    const text = this.stripHtml(emailBody);
    if (!text) return null;
    
    let type = null;
    let amount = this.extractAmount(text);
    let balance = this.extractBalance(text);
    let merchant = null;
    let dateStr = null;
    let reasoning = [];
    let confidence = 0;
    
    const debitMatch = text.match(/Debited (?:Rs\.?|INR|₹)\s*([\d,.]+)\s*on\s*([\d-]+|\d{1,2}[a-zA-Z]{3}\d{2,4})\s*by\s*(.*?)(?:\.|\s*Bal)/i);
    const creditMatch = text.match(/Credited (?:Rs\.?|INR|₹)\s*([\d,.]+)\s*on\s*([\d-]+|\d{1,2}[a-zA-Z]{3}\d{2,4})\.\s*(.*?)(?:\.|\s*Bal)/i);

    if (debitMatch) {
      type = 'Debit';
      if (!amount) amount = this.normalizeAmount(debitMatch[1]);
      dateStr = debitMatch[2];
      merchant = debitMatch[3].trim();
      reasoning.push('Matched Union Debit pattern');
    } else if (creditMatch) {
      type = 'Credit';
      if (!amount) amount = this.normalizeAmount(creditMatch[1]);
      dateStr = creditMatch[2];
      merchant = creditMatch[3].trim();
      reasoning.push('Matched Union Credit pattern');
    } else {
      if (/debited/i.test(text)) {
        type = 'Debit';
        reasoning.push('Detected generic debit keyword');
      } else if (/credited/i.test(text)) {
        type = 'Credit';
        reasoning.push('Detected generic credit keyword');
      }
    }

    if (!type || !amount) return null;

    if (amount) confidence += 0.3;
    if (merchant) confidence += 0.3;
    if (dateStr) confidence += 0.2;
    if (balance !== null) confidence += 0.1;
    if (type) confidence += 0.1;

    const finalDate = this.parseIndianDate(dateStr, emailDate);
    return this.buildResult(finalDate, amount, type, merchant, balance, text, confidence, reasoning);
  }
}
