import { getToken, removeCachedToken, clearGmailAuthorization } from "../utils/oauth.js";
import { GmailClient } from "../utils/gmailClient.js";
import { parseEmail, getParserNames } from "../utils/parsers/registry.js";
import { normalizeMerchant } from "../utils/merchantEngine.js";
import { computeConfidence } from "../utils/confidenceEngine.js";
import { mergeGmailTransactions } from "../utils/duplicateDetector.js";
import { removeLegacyDemoRows } from "../utils/legacyDemo.js";
import { get, set, remove, clearAll, KEYS, getSettings } from "../utils/storage.js";

const ALARM = "ep-scan";
const OVERLAP_MINUTES = 15;
let syncInProgress;
let disconnectInProgress;

export function performSync() {
  if (disconnectInProgress) return Promise.resolve({ ok: false, error: "Gmail is disconnecting." });
  syncInProgress ??= syncGmail().finally(() => { syncInProgress = undefined; });
  return syncInProgress;
}

async function syncGmail() {
  if (!(await get(KEYS.GMAIL_CONNECTED, false))) {
    return { ok: false, error: "Connect Gmail in Settings to scan bank alerts." };
  }

  let token;
  try {
    token = await getToken();
    if (!token) throw new Error("AUTH_EXPIRED");
    const client = new GmailClient(token);
    const settings = await getSettings();
    const banks = getParserNames().filter((bank) => settings.supportedBanks?.includes(bank));
    const previous = Date.parse(await get(KEYS.LAST_SCAN));
    const since = Number.isFinite(previous) ? previous - OVERLAP_MINUTES * 60_000 : null;
    const started = new Date().toISOString();
    const existing = removeLegacyDemoRows(await get(KEYS.TRANSACTIONS, []));
    const seen = new Set(existing.map((transaction) => transaction.gmailMessageId).filter(Boolean));
    const incoming = [];

    if (banks.length) {
      const query = GmailClient.buildBankQuery(banks, since);
      let pageToken;
      do {
        const page = await client.searchMessages(query, 100, pageToken);
        const ids = [...new Set(page.messages.map(({ id }) => id))].filter((id) => !seen.has(id));
        const messages = await client.getMessages(ids);
        for (const message of messages) {
          const parsed = parseEmail(message.from, message.subject, message.body, message.date);
          if (!parsed || !banks.includes(parsed.bank)) continue;
          const merchant = normalizeMerchant(parsed.merchant);
          const transaction = { ...parsed, merchant: merchant.canonical, category: merchant.category };
          incoming.push({ ...transaction, ...computeConfidence(transaction), gmailMessageId: message.id });
          seen.add(message.id);
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
    }

    // Re-read before writing so edits made while Gmail was loading are preserved.
    const current = removeLegacyDemoRows(await get(KEYS.TRANSACTIONS, []));
    const merged = mergeGmailTransactions(current, incoming);
    await set(KEYS.TRANSACTIONS, merged);
    await set(KEYS.LAST_SCAN, started);
    await remove(KEYS.SYNC_ERROR);
    return { ok: true, added: merged.length - current.length };
  } catch (error) {
    const expired = error.message === "AUTH_EXPIRED";
    if (expired) {
      await set(KEYS.GMAIL_CONNECTED, false);
      await removeCachedToken(token).catch(() => {});
    }
    const message = expired ? "Gmail access expired. Reconnect in Settings and try again." : error.message;
    await set(KEYS.SYNC_ERROR, message);
    return { ok: false, error: message };
  }
}

async function disconnect(wipe) {
  if (disconnectInProgress) return disconnectInProgress;
  disconnectInProgress = (async () => {
    await syncInProgress;
    await set(KEYS.GMAIL_CONNECTED, false);
    await clearGmailAuthorization().catch(() => {});
    if (wipe) {
      await clearAll();
      await scheduleScan();
    }
    else {
      await remove(KEYS.LAST_SCAN);
      await remove(KEYS.SYNC_ERROR);
    }
    return { ok: true };
  })().finally(() => { disconnectInProgress = undefined; });
  return disconnectInProgress;
}

async function scheduleScan() {
  const settings = await getSettings();
  await chrome.alarms.create(ALARM, { periodInMinutes: settings.scanFrequency || 30 });
}

if (globalThis.chrome?.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    const transactions = await get(KEYS.TRANSACTIONS, []);
    const realTransactions = removeLegacyDemoRows(transactions);
    if (transactions.length !== realTransactions.length) await set(KEYS.TRANSACTIONS, realTransactions);
    await chrome.storage.local.remove(["ep_oauth_token", "ep_oauth_token_expiry", "ep_history_id"]);
    await scheduleScan();
    if (reason === "install") await chrome.tabs.create({ url: chrome.runtime.getURL("pages/welcome.html") });
  });

  chrome.runtime.onStartup.addListener(async () => {
    if (!(await chrome.alarms.get(ALARM))) await scheduleScan();
  });

  chrome.alarms.onAlarm.addListener(({ name }) => {
    if (name === ALARM) void performSync();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    let operation;
    switch (message.type) {
      case "ep_reschedule":
        operation = scheduleScan().then(() => ({ ok: true }));
        break;
      case "ep_force_sync":
        operation = performSync();
        break;
      case "ep_disconnect":
        operation = disconnect(false);
        break;
      case "ep_wipe":
        operation = disconnect(true);
        break;
      default:
        return false;
    }
    operation.then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });
}
