import { ParserBase } from './parserBase.js';

export class HDFCParser extends ParserBase {
  constructor() {
    super('HDFC', [/alerts?@hdfcbank\.net/i, /hdfcbank/i, /hdfc/i]);
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
    
    const debitMatch = text.match(/(?:Rs\.?|INR|₹)\s*([\d,.]+)\s*debited.*on\s*([\d-]+|\d{1,2}[a-zA-Z]{3}\d{2,4})\s*to\s*(.*?)(?:\.|\s*Avl)/i);
    const upiMatch = text.match(/(?:Rs\.?|INR|₹)\s*([\d,.]+)\s*transferred.*to\s*(.*?)\s*via\s*UPI\s*on\s*([\d-]+|\d{1,2}[a-zA-Z]{3}\d{2,4})/i);
    const creditMatch = text.match(/(?:Rs\.?|INR|₹)\s*([\d,.]+)\s*credited.*on\s*([\d-]+|\d{1,2}[a-zA-Z]{3}\d{2,4})\.\s*(.*?)(?:\.|\s*Avl)/i);

    if (upiMatch) {
      type = 'Debit';
      if (!amount) amount = this.normalizeAmount(upiMatch[1]);
      merchant = upiMatch[2].trim();
      dateStr = upiMatch[3];
      reasoning.push('Matched HDFC UPI transfer pattern');
    } else if (debitMatch) {
      type = 'Debit';
      if (!amount) amount = this.normalizeAmount(debitMatch[1]);
      dateStr = debitMatch[2];
      merchant = debitMatch[3].trim();
      reasoning.push('Matched HDFC Debit pattern');
    } else if (creditMatch) {
      type = 'Credit';
      if (!amount) amount = this.normalizeAmount(creditMatch[1]);
      dateStr = creditMatch[2];
      merchant = creditMatch[3].trim();
      reasoning.push('Matched HDFC Credit pattern');
    } else {
      if (/debited|transferred/i.test(text)) {
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
