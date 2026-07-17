import { set, KEYS } from "../utils/storage.js";
    import { generateMockTransactions } from "../utils/mockData.js";
    import { authenticate } from "../utils/oauth.js";

    document.getElementById("demo").addEventListener("click", async () => {
      const txs = generateMockTransactions(120);
      await set(KEYS.TRANSACTIONS, txs);
      await set(KEYS.GMAIL_CONNECTED, false);
      location.href = "dashboard.html";
    });

    document.getElementById("connect").addEventListener("click", async () => {
      try {
        await authenticate();
        await set(KEYS.GMAIL_CONNECTED, true);
        
        // Force an initial sync after connecting
        if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: "ep_force_sync" });
        }
        
        location.href = "dashboard.html";
      } catch (err) {
        console.error("Auth error:", err);
        alert("Failed to connect to Gmail: " + err.message + "\nMake sure you have configured OAuth in manifest.json.");
      }
    });