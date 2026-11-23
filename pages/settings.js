import { mountLayout } from "./_layout.js";
    import { get, set, remove, KEYS, getSettings, saveSettings } from "../utils/storage.js";
    import { connectGmail, sendWorkerRequest } from "../utils/gmailConnection.js";
    import { getParserNames } from "../utils/parsers/registry.js";
    import { importFromJSON } from "../utils/exportImport.js";
    import { removeLegacyDemoRows } from "../utils/legacyDemo.js";

    await mountLayout("settings");
    const settings = await getSettings();

    const banksEl = document.getElementById("banks");
    for (const bank of getParserNames()) {
      const label = document.createElement("label");
      label.className = "bank-chip";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = settings.supportedBanks?.includes(bank);
      checkbox.onchange = async () => {
        const selected = new Set(settings.supportedBanks || []);
        if (checkbox.checked) selected.add(bank);
        else selected.delete(bank);
        settings.supportedBanks = getParserNames().filter((name) => selected.has(name));
        await saveSettings({ supportedBanks: settings.supportedBanks });
        await remove(KEYS.LAST_SCAN);
      };
      label.append(checkbox, " ", bank);
      banksEl.append(label);
    }

    // Freq
    const freq = document.getElementById("freq");
    freq.value = String(settings.scanFrequency);
    freq.onchange = async () => {
      await saveSettings({ scanFrequency: +freq.value });
      if (chrome.runtime && chrome.runtime.sendMessage) {
        await sendWorkerRequest("ep_reschedule");
      }
    };

    // Budget
    const budget = document.getElementById("budget");
    budget.value = settings.monthlyBudget;
    budget.onchange = async () => { await saveSettings({ monthlyBudget: +budget.value }); };

    // Theme
    const themeToggle = document.getElementById("themeToggle");
    themeToggle.checked = settings.theme === "dark";
    themeToggle.onchange = async () => {
      const t = themeToggle.checked ? "dark" : "light";
      await saveSettings({ theme: t });
      document.documentElement.setAttribute("data-theme", t);
    };

    // Export / Import / Wipe
    document.getElementById("exportBtn").onclick = async () => {
      const data = {
        transactions: await get(KEYS.TRANSACTIONS, []),
        settings: await getSettings(),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `expensepilot-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    document.getElementById("importFile").onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text();
      try {
        const data = importFromJSON(text);
        if (!data) throw new Error("Invalid backup");
        await set(KEYS.TRANSACTIONS, removeLegacyDemoRows(data.transactions));
        await remove(KEYS.LAST_SCAN);
        await saveSettings(data.settings);
        await sendWorkerRequest("ep_reschedule");
        alert("Imported successfully.");
        location.reload();
      } catch { alert("Invalid JSON file."); }
    };
    document.getElementById("wipeBtn").onclick = async () => {
      if (!confirm("Delete ALL local data? This can't be undone.")) return;
      try {
        await sendWorkerRequest("ep_wipe");
        location.href = "welcome.html";
      } catch (error) {
        alert(error.message);
      }
    };

    const connected = await get(KEYS.GMAIL_CONNECTED, false);
    const status = document.getElementById("gmailStatus");
    const connect = document.getElementById("connect");
    const disconnect = document.getElementById("disconnect");
    const lastScan = await get(KEYS.LAST_SCAN);
    const syncError = await get(KEYS.SYNC_ERROR);
    status.textContent = syncError || (connected
      ? lastScan ? `Connected. Last scan ${new Date(lastScan).toLocaleString()}` : "Connected. No completed scan yet."
      : `Gmail is disconnected. Extension ID ${chrome.runtime.id}.`);
    connect.style.display = connected ? "none" : "";
    disconnect.style.display = connected ? "" : "none";

    async function runConnectionAction(button, action, destination) {
      button.disabled = true;
      try {
        await action();
        location.href = destination;
      } catch (error) {
        status.textContent = error.message;
        const nowConnected = await get(KEYS.GMAIL_CONNECTED, false);
        connect.style.display = nowConnected ? "none" : "";
        disconnect.style.display = nowConnected ? "" : "none";
      } finally {
        button.disabled = false;
      }
    }

    connect.onclick = () => runConnectionAction(connect, connectGmail, "dashboard.html");
    disconnect.onclick = () => runConnectionAction(disconnect, () => sendWorkerRequest("ep_disconnect"), "settings.html");
