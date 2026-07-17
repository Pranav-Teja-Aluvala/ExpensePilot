// Local storage wrapper — everything stays on-device.
export const KEYS = {
  TRANSACTIONS: "ep_transactions",
  SETTINGS: "ep_settings",
  GMAIL_CONNECTED: "ep_gmail_connected",
  LAST_SCAN: "ep_last_scan",
};

const isExt = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

export async function get(key, fallback = null) {
  if (isExt) {
    return new Promise((r) => chrome.storage.local.get([key], (o) => r(o[key] ?? fallback)));
  }
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

export async function set(key, value) {
  if (isExt) {
    return new Promise((r) => chrome.storage.local.set({ [key]: value }, r));
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export async function remove(key) {
  if (isExt) return new Promise((r) => chrome.storage.local.remove([key], r));
  localStorage.removeItem(key);
}

export async function clearAll() {
  if (isExt) return new Promise((r) => chrome.storage.local.clear(r));
  localStorage.clear();
}

export const DEFAULT_SETTINGS = {
  theme: "dark",
  scanFrequency: 30, // minutes
  monthlyBudget: 50000,
  supportedBanks: ["SBI", "HDFC", "ICICI", "Axis", "Kotak", "Union Bank"],
};

export async function getSettings() {
  const s = await get(KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function saveSettings(patch) {
  const cur = await getSettings();
  await set(KEYS.SETTINGS, { ...cur, ...patch });
}
