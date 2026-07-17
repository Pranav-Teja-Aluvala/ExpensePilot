import { get, KEYS } from "../utils/storage.js";
    import { monthStats } from "../utils/stats.js";
    import { inr } from "../utils/format.js";

    (async () => {
      const txs = (await get(KEYS.TRANSACTIONS, [])) || [];
      const connected = await get(KEYS.GMAIL_CONNECTED, false);
      document.getElementById("statusLabel").textContent = connected ? "Gmail connected" : "Demo mode";
      const s = monthStats(txs);
      document.getElementById("spent").textContent = inr(s.spent);
      document.getElementById("income").textContent = inr(s.income);
      document.getElementById("savings").textContent = inr(s.savings);
    })();

    function openPage(p) {
      const url = chrome.runtime.getURL("pages/" + p);
      chrome.tabs.create({ url });
    }
    document.getElementById("openDash").onclick = () => openPage("dashboard.html");
    document.getElementById("openSettings").onclick = () => openPage("settings.html");