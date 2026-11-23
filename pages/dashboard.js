import { mountLayout } from "./_layout.js";
    import { get, KEYS } from "../utils/storage.js";
    import { monthStats, byCategory } from "../utils/stats.js";
    import { inr, fmtDate, animateNumber, escapeHtml } from "../utils/format.js";
    import { sendWorkerRequest } from "../utils/gmailConnection.js";
    import { compareMonthToDate, changeLabel } from "../utils/spendingInsights.js";

    await mountLayout("dashboard");
    const connected = await get(KEYS.GMAIL_CONNECTED, false);
    const scanStatus = document.getElementById("scanStatus");
    const lastScan = await get(KEYS.LAST_SCAN);
    scanStatus.textContent = (await get(KEYS.SYNC_ERROR)) || (lastScan && connected ? `Last scan ${new Date(lastScan).toLocaleString()}` : "");

    const txs = (await get(KEYS.TRANSACTIONS, [])) || [];
    const today = new Date();
    const s = monthStats(txs, today);
    const comparison = compareMonthToDate(txs, today);
    const delta = (key) => comparison.previous[key] > 0
      ? `${changeLabel(comparison.current[key], comparison.previous[key])} vs prior month through day ${comparison.day}`
      : changeLabel(comparison.current[key], comparison.previous[key]);

    document.getElementById("subLine").textContent =
      `${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })} · ${s.count} transactions`;

    const cards = [
      { label: "Spent this month", value: s.spent, icon: "💸", delta: delta("spent"), cls: "" },
      { label: "Income", value: s.income, icon: "💰", delta: delta("income"), cls: "" },
      { label: "Net cash flow", value: s.savings, icon: "🏦", delta: "Recorded credits minus debits", cls: "" },
      { label: "Largest expense", value: s.largest ? s.largest.amount : 0, icon: "🔥", delta: "", cls: "delta-down" },
    ];
    const statsEl = document.getElementById("stats");
    statsEl.innerHTML = cards.map((c, i) => `
      <div class="card">
        <div class="card-row">
          <div>
            <div class="stat-label">${c.label}</div>
            <div class="stat-value currency" id="sv-${i}">₹0</div>
            <div class="stat-delta ${c.cls}">${c.delta}</div>
          </div>
          <div class="stat-icon">${c.icon}</div>
        </div>
      </div>`).join("");
    cards.forEach((c, i) => animateNumber(document.getElementById(`sv-${i}`), c.value, 900, (v) => inr(v)));
    if (s.largest) statsEl.lastElementChild.querySelector(".stat-delta").textContent = s.largest.merchant;

    // Recent
    const recent = [...txs].sort((first, second) => Date.parse(second.date) - Date.parse(first.date)).slice(0, 6);
    document.getElementById("recent").innerHTML = recent.length ? recent.map((t) => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="stat-icon" style="width:36px;height:36px;font-size:14px">${escapeHtml(t.merchant[0])}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.merchant)}</div>
          <div style="color:var(--text-mute);font-size:12px">${fmtDate(t.date)} · ${escapeHtml(t.bank)}</div>
        </div>
        <div style="text-align:right">
          <div class="currency" style="font-weight:600;color:${t.type === "Credit" ? "var(--success)" : "var(--text)"}">${t.type === "Credit" ? "+" : "-"}${inr(t.amount)}</div>
          <div class="pill pill-cat" style="margin-top:2px">${escapeHtml(t.category)}</div>
        </div>
      </div>
    `).join("") : `<div class="empty"><h3>No transactions yet</h3><p>${connected ? "No supported bank alerts have been imported yet." : 'Connect Gmail in <a href="settings.html">Settings</a> to import bank alerts.'}</p></div>`;

    // Category chart
    const cats = byCategory(s.transactions).slice(0, 6);
    const ctx = document.getElementById("catChart");
    if (cats.length) {
      new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: cats.map((c) => c[0]),
          datasets: [{
            data: cats.map((c) => c[1]),
            backgroundColor: ["#7c5cff","#22d3ee","#33e0a3","#ffb547","#ff5c7a","#a78bfa","#60a5fa"],
            borderWidth: 0, borderRadius: 6,
          }],
        },
        options: {
          plugins: { legend: { position: "right", labels: { color: "#9aa0b4", boxWidth: 10 } } },
          cutout: "62%", maintainAspectRatio: false,
        },
      });
    }

    const scanButton = document.getElementById("refreshBtn");
    scanButton.textContent = connected ? "Scan now" : "Connect Gmail";
    scanButton.onclick = async () => {
      if (!connected) {
        location.href = "settings.html";
        return;
      }
      scanButton.disabled = true;
      scanStatus.textContent = "Scanning bank alerts…";
      try {
        await sendWorkerRequest("ep_force_sync");
        location.reload();
      } catch (error) {
        scanStatus.textContent = error.message;
      } finally {
        scanButton.disabled = false;
      }
    };
