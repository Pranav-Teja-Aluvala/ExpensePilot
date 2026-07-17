import { mountLayout } from "./_layout.js";
    import { get, KEYS } from "../utils/storage.js";
    import { byCategory, weeklyBuckets, monthlyTrend, dailyHeatmap } from "../utils/stats.js";
    import { inr } from "../utils/format.js";

    await mountLayout("analytics");

    const txs = (await get(KEYS.TRANSACTIONS, [])) || [];

    const cats = byCategory(txs);
    new Chart(document.getElementById("pie"), {
      type: "pie",
      data: {
        labels: cats.map((c) => c[0]),
        datasets: [{
          data: cats.map((c) => c[1]),
          backgroundColor: ["#7c5cff","#22d3ee","#33e0a3","#ffb547","#ff5c7a","#a78bfa","#60a5fa","#f472b6","#34d399","#fb923c","#94a3b8"],
          borderWidth: 0,
        }],
      },
      options: { plugins: { legend: { position: "right", labels: { color: "#9aa0b4" } } }, maintainAspectRatio: false },
    });

    const week = weeklyBuckets(txs);
    new Chart(document.getElementById("bar"), {
      type: "bar",
      data: {
        labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
        datasets: [{ label: "Spend", data: week, backgroundColor: "#7c5cff", borderRadius: 8 }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#9aa0b4" }, grid: { display: false } },
          y: { ticks: { color: "#9aa0b4", callback: (v) => inr(v) }, grid: { color: "rgba(255,255,255,0.05)" } },
        },
        maintainAspectRatio: false,
      },
    });

    const trend = monthlyTrend(txs, 6);
    new Chart(document.getElementById("line"), {
      type: "line",
      data: {
        labels: trend.labels,
        datasets: [
          { label: "Spending", data: trend.spendVals, borderColor: "#ff5c7a", backgroundColor: "rgba(255,92,122,0.12)", fill: true, tension: 0.35, borderWidth: 2, pointRadius: 4 },
          { label: "Income", data: trend.incomeVals, borderColor: "#33e0a3", backgroundColor: "rgba(51,224,163,0.10)", fill: true, tension: 0.35, borderWidth: 2, pointRadius: 4 },
        ],
      },
      options: {
        plugins: { legend: { labels: { color: "#9aa0b4" } } },
        scales: {
          x: { ticks: { color: "#9aa0b4" }, grid: { display: false } },
          y: { ticks: { color: "#9aa0b4", callback: (v) => inr(v) }, grid: { color: "rgba(255,255,255,0.05)" } },
        },
        maintainAspectRatio: false,
      },
    });

    // Heatmap
    const hm = dailyHeatmap(txs, 90);
    const max = Math.max(1, ...hm.map(([, v]) => v));
    const el = document.getElementById("heatmap");
    el.innerHTML = hm.map(([d, v]) => {
      const intensity = v / max;
      const bg = v === 0 ? "" : `background: rgba(124,92,255,${0.15 + intensity * 0.75})`;
      return `<div class="heat-cell" title="${d}: ${inr(v)}" style="${bg}"></div>`;
    }).join("");