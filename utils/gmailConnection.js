import { authenticate } from "./oauth.js";
import { set, KEYS } from "./storage.js";

export async function connectGmail() {
  await authenticate();
  await set(KEYS.GMAIL_CONNECTED, true);
  return sendWorkerRequest("ep_force_sync");
}

export async function sendWorkerRequest(type) {
  const result = await chrome.runtime.sendMessage({ type });
  if (!result?.ok) throw new Error(result?.error || "ExpensePilot could not complete the request. Try again.");
  return result;
}
