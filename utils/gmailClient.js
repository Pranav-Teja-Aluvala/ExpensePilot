export class GmailClient {
  constructor(accessToken) {
    this.token = accessToken;
    this.baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';
    this.maxRetries = 3;
  }

  async _fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const resp = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
        if (resp.ok) return resp.json();
        if (resp.status === 401) throw new Error('AUTH_EXPIRED');
        if (resp.status === 429 || resp.status >= 500) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`Gmail API error: ${resp.status} ${resp.statusText}`);
      } catch (err) {
        if (err.message === 'AUTH_EXPIRED') throw err;
        if (attempt === this.maxRetries - 1) throw err;
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    throw new Error('Gmail API: max retries exceeded');
  }

  _decodeBase64Url(encoded) {
    if (!encoded) return '';
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    try { return decodeURIComponent(escape(atob(base64))); } 
    catch { try { return atob(base64); } catch { return ''; } }
  }

  _stripHtml(html) {
    return (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  _getHeader(headers, name) {
    const h = (headers || []).find(h => h.name.toLowerCase() === name.toLowerCase());
    return h ? h.value : '';
  }

  _extractBody(payload) {
    if (!payload) return '';
    if (payload.body && payload.body.data) {
      return this._decodeBase64Url(payload.body.data);
    }
    if (payload.parts) {
      let textPart = '', htmlPart = '';
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          textPart = this._decodeBase64Url(part.body.data);
        } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
          htmlPart = this._decodeBase64Url(part.body.data);
        } else if (part.parts) {
          const nested = this._extractBody(part);
          if (nested) return nested;
        }
      }
      return textPart || this._stripHtml(htmlPart);
    }
    return '';
  }

  async searchMessages(query, maxResults = 50, pageToken = null) {
    const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await this._fetch(`/messages?${params}`);
    return {
      messages: data.messages || [],
      nextPageToken: data.nextPageToken || null,
      resultSizeEstimate: data.resultSizeEstimate || 0,
    };
  }

  async getMessage(messageId) {
    const data = await this._fetch(`/messages/${messageId}?format=full`);
    const headers = data.payload ? data.payload.headers : [];
    const body = this._extractBody(data.payload);
    return {
      id: data.id,
      from: this._getHeader(headers, 'From'),
      subject: this._getHeader(headers, 'Subject'),
      date: this._getHeader(headers, 'Date'),
      body: body.includes('<') ? this._stripHtml(body) : body,
      snippet: data.snippet || '',
    };
  }

  async getMessages(messageIds) {
    const results = [];
    for (let i = 0; i < messageIds.length; i += 10) {
      const batch = messageIds.slice(i, i + 10);
      const promises = batch.map(id => this.getMessage(id).catch(() => null));
      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter(Boolean));
      if (i + 10 < messageIds.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    return results;
  }

  async getHistory(startHistoryId) {
    const params = new URLSearchParams({
      startHistoryId: String(startHistoryId),
      historyTypes: 'messageAdded',
      labelId: 'INBOX',
    });
    try {
      const data = await this._fetch(`/history?${params}`);
      return {
        history: data.history || [],
        historyId: data.historyId || startHistoryId,
      };
    } catch (err) {
      if (err.message && err.message.includes('404')) {
        return { history: [], historyId: null, fullSyncRequired: true };
      }
      throw err;
    }
  }

  async getProfile() {
    const data = await this._fetch('/profile');
    return {
      emailAddress: data.emailAddress,
      historyId: data.historyId,
    };
  }

  static buildBankQuery(bankNames) {
    const senders = {
      'SBI': 'from:sbi OR from:"state bank"',
      'HDFC': 'from:hdfcbank OR from:"hdfc bank"',
      'ICICI': 'from:icicibank OR from:"icici bank"',
      'Axis': 'from:axisbank OR from:"axis bank"',
      'Kotak': 'from:kotak',
      'Union Bank': 'from:unionbankofindia OR from:"union bank"',
    };
    const parts = bankNames
      .map(b => senders[b])
      .filter(Boolean);
    if (parts.length === 0) return 'from:bank subject:(transaction OR debit OR credit OR alert)';
    return `(${parts.join(' OR ')}) subject:(transaction OR debit OR credit OR alert) newer_than:90d`;
  }
}
