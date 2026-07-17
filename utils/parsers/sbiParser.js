import { ParserBase } from './parserBase.js';

export class SBIParser extends ParserBase {
  constructor() {
    super('SBI', [/alerts?@sbi\.co\.in/i, /sbi/i, /state\s*bank/i]);
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
    
    // Debit patterns
    const debitTrfMatch = text.match(/debited for (?:Rs\.?|INR|₹)\s*([\d,.]+)\s*on\s*([\d-]+|\d{1,2}[a-zA-Z]{3}\d{2,4})\s*(?:by|trf|trf to|transfer to)\s*(.*?)(?:\.|\s*Avl|\s*UPI)/i);
    const debitUpiMatch = text.match(/(?:Rs\.?|INR|₹)\s*([\d,.]+)\s*debited.*on\s*([\d-]+|\d{1,2}[a-zA-Z]{3}\d{2,4})\s*(?:to|trf to)\s*(.*?)(?:\.|\s*UPI|\s*Avl)/i);
    const atmMatch = text.match(/ATM cash withdrawal.*(?:Rs\.?|INR|₹)\s*([\d,.]+).*on\s*([\d-]+|\d{1,2}[a-zA-Z]{3}\d{2,4})\s*at\s*(.*?)(?:\.|\s*Avl)/i);

    // Credit patterns
    const creditMatch = text.match(/credited (?:by |for )?(?:Rs\.?|INR|₹)\s*([\d,.]+)\s*on\s*([\d-]+|\d{1,2}[a-zA-Z]{3}\d{2,4})/i);

    if (debitTrfMatch) {
      type = 'Debit';
      if (!amount) amount = this.normalizeAmount(debitTrfMatch[1]);
      dateStr = debitTrfMatch[2];
      merchant = debitTrfMatch[3].trim();
      reasoning.push('Matched SBI Debit Transfer pattern');
    } else if (debitUpiMatch) {
      type = 'Debit';
      if (!amount) amount = this.normalizeAmount(debitUpiMatch[1]);
      dateStr = debitUpiMatch[2];
      merchant = debitUpiMatch[3].trim();
      reasoning.push('Matched SBI UPI Debit pattern');
    } else if (atmMatch) {
      type = 'Debit';
      if (!amount) amount = this.normalizeAmount(atmMatch[1]);
      dateStr = atmMatch[2];
      merchant = 'ATM Cash Withdrawal ' + atmMatch[3].trim();
      reasoning.push('Matched SBI ATM pattern');
    } else if (creditMatch) {
      type = 'Credit';
      if (!amount) amount = this.normalizeAmount(creditMatch[1]);
      dateStr = creditMatch[2];
      const detailMatch = text.match(/credited.*on\s*[\d-a-zA-Z]+\.?\s*(.*?)(?:\.|\s*Avl)/i);
      if (detailMatch) merchant = detailMatch[1].trim();
      reasoning.push('Matched SBI Credit pattern');
    } else {
      // Generic fallback
      if (/debited/i.test(text) || /withdrawal/i.test(text)) {
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
