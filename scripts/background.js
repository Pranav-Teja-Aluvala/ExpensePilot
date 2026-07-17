import { getToken, isTokenExpired } from '../utils/oauth.js';
import { GmailClient } from '../utils/gmailClient.js';
import { parseEmail, getParserNames } from '../utils/parsers/registry.js';
import { normalizeMerchant } from '../utils/merchantEngine.js';
import { computeConfidence } from '../utils/confidenceEngine.js';
import { deduplicateTransactions } from '../utils/duplicateDetector.js';
import { Logger } from '../utils/logger.js';
import { get, set, KEYS, getSettings } from '../utils/storage.js';

const ALARM = "ep-scan";

export async function performSync() {
  Logger.info('sync', 'Starting background sync');
  try {
    const isConnected = await get(KEYS.GMAIL_CONNECTED, false);
    if (!isConnected) {
      Logger.info('sync', 'Gmail not connected, skipping');
      return;
    }

    const token = await getToken();
    if (!token) {
      Logger.warn('sync', 'No valid token found');
      return;
    }

    const client = new GmailClient(token);
    const settings = await getSettings();
    const banks = settings.supportedBanks || getParserNames();
    
    // First, sync new messages based on history if available
    let historyId = await get('ep_history_id', null);
    let messagesToFetch = [];
    
    if (historyId) {
      Logger.debug('sync', `Fetching history since ${historyId}`);
      const hist = await client.getHistory(historyId);
      if (hist.fullSyncRequired) {
        Logger.warn('sync', 'History expired, full sync required');
        historyId = null;
      } else {
        historyId = hist.historyId;
        const newMsgIds = new Set();
        hist.history.forEach(h => {
          if (h.messagesAdded) {
            h.messagesAdded.forEach(ma => newMsgIds.add(ma.message.id));
          }
        });
        messagesToFetch = Array.from(newMsgIds);
      }
    }

    if (!historyId) {
      Logger.debug('sync', 'Performing full search');
      const query = GmailClient.buildBankQuery(banks);
      let pageToken = null;
      let count = 0;
      do {
        const searchRes = await client.searchMessages(query, 100, pageToken);
        searchRes.messages.forEach(m => messagesToFetch.push(m.id));
        pageToken = searchRes.nextPageToken;
        count++;
      } while (pageToken && count < 10);
      
      const profile = await client.getProfile();
      historyId = profile.historyId;
    }

    if (messagesToFetch.length === 0) {
      Logger.info('sync', 'No new messages to process');
      if (historyId) await set('ep_history_id', historyId);
      await set(KEYS.LAST_SCAN, new Date().toISOString());
      return;
    }

    Logger.info('sync', `Fetching ${messagesToFetch.length} messages`);
    const msgs = await client.getMessages(messagesToFetch);
    
    let existingTxs = await get(KEYS.TRANSACTIONS, []);
    let newTxs = [];

    for (const msg of msgs) {
      const parsed = parseEmail(msg.from, msg.subject, msg.body, msg.date);
      if (parsed) {
        // Run through merchant engine
        const mInfo = normalizeMerchant(parsed.merchant);
        parsed.merchant = mInfo.canonical;
        parsed.category = mInfo.category;
        
        // Add confidence
        const cInfo = computeConfidence(parsed);
        parsed.confidence = cInfo.confidence;
        parsed.confidenceLevel = cInfo.confidenceLevel;
        parsed.reasoning = cInfo.reasoning;
        
        newTxs.push(parsed);
      }
    }

    if (newTxs.length > 0) {
      Logger.info('sync', `Parsed ${newTxs.length} new transactions`);
      const combined = [...existingTxs, ...newTxs];
      const deduplicated = deduplicateTransactions(combined);
      await set(KEYS.TRANSACTIONS, deduplicated);
      Logger.info('sync', `Saved ${deduplicated.length} total transactions (${deduplicated.length - existingTxs.length} added)`);
    }

    if (historyId) await set('ep_history_id', historyId);
    await set(KEYS.LAST_SCAN, new Date().toISOString());
    Logger.info('sync', 'Sync completed successfully');

    // Notify frontend
    chrome.runtime.sendMessage({ type: "ep_sync_complete" }).catch(() => {});

  } catch (err) {
    Logger.error('sync', 'Sync failed', err.message);
    if (err.message === 'AUTH_EXPIRED') {
      await set(KEYS.GMAIL_CONNECTED, false);
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'assets/icon.png',
          title: 'ExpensePilot Disconnected',
          message: 'Your Gmail connection expired. Please reconnect in the app.'
        });
      }
    }
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  chrome.alarms.create(ALARM, { periodInMinutes: settings.scanFrequency || 30 });
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/welcome.html") });
});

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== ALARM) return;
  await performSync();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "ep_reschedule") {
    chrome.alarms.clear(ALARM, () => {
      chrome.alarms.create(ALARM, { periodInMinutes: msg.freq || 30 });
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === "ep_force_sync") {
    performSync().then(() => sendResponse({ ok: true }));
    return true;
  }
});
