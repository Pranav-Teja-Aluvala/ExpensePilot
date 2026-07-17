import { mountLayout } from "./_layout.js";
    import { get, set, remove, clearAll, KEYS, getSettings, saveSettings } from "../utils/storage.js";

    await mountLayout("settings");
    const settings = await getSettings();

    // Banks
    const banksEl = document.getElementById("banks");
    function renderBanks() {
      banksEl.innerHTML = settings.supportedBanks.map((b, i) => `
        <span class="bank-chip">${b} <button data-i="${i}" style="background:none;border:none;color:var(--text-mute);cursor:pointer;font-size:14px;margin-left:4px">×</button></span>
      `).join("");
      banksEl.querySelectorAll("button").forEach((btn) => {
        btn.onclick = async () => {
          settings.supportedBanks.splice(+btn.dataset.i, 1);
          await saveSettings({ supportedBanks: settings.supportedBanks });
          renderBanks();
        };
      });
    }
    renderBanks();
    document.getElementById("addBank").onclick = async () => {
      const v = document.getElementById("newBank").value.trim();
      if (!v) return;
      settings.supportedBanks.push(v);
      await saveSettings({ supportedBanks: settings.supportedBanks });
      document.getElementById("newBank").value = "";
      renderBanks();
    };

    // Freq
    const freq = document.getElementById("freq");
    freq.value = String(settings.scanFrequency);
    freq.onchange = async () => {
      await saveSettings({ scanFrequency: +freq.value });
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: "ep_reschedule", freq: +freq.value });
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
        const data = JSON.parse(text);
        if (Array.isArray(data.transactions)) await set(KEYS.TRANSACTIONS, data.transactions);
        if (data.settings) await saveSettings(data.settings);
        alert("Imported successfully.");
        location.reload();
      } catch { alert("Invalid JSON file."); }
    };
    document.getElementById("wipeBtn").onclick = async () => {
      if (!confirm("Delete ALL local data? This can't be undone.")) return;
      await clearAll();
      location.href = "welcome.html";
    };

    // Gmail
    const connected = await get(KEYS.GMAIL_CONNECTED, false);
    document.getElementById("gmailStatus").innerHTML = connected
      ? `<span class="pill pill-credit">Connected</span> <span style="color:var(--text-dim);font-size:13px;margin-left:8px">Last scan: ${(await get(KEYS.LAST_SCAN)) || "—"}</span>`
      : `<span class="pill pill-debit">Not connected</span>`;
    document.getElementById("disconnect").onclick = async () => {
      await remove(KEYS.GMAIL_CONNECTED);
      await remove(KEYS.LAST_SCAN);
      // Also revoke Chrome identity cache if available:
      if (chrome.identity && chrome.identity.clearAllCachedAuthTokens) {
        chrome.identity.clearAllCachedAuthTokens(() => {});
      }
      location.reload();
    };