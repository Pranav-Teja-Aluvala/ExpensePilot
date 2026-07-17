// Renders sidebar + applies theme. Used by all app pages.
import { getSettings } from "../utils/storage.js";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "◈" },
  { id: "analytics", label: "Analytics", icon: "▲" },
  { id: "transactions", label: "Transactions", icon: "≡" },
  { id: "insights", label: "AI Insights", icon: "✦" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export async function mountLayout(activeId) {
  const settings = await getSettings();
  document.documentElement.setAttribute("data-theme", settings.theme || "dark");

  const side = document.getElementById("sidebar");
  side.innerHTML = `
    <div class="brand">
      <div class="brand-mark">E</div>
      <div>
        <div class="brand-name">ExpensePilot</div>
        <div class="brand-sub">Privacy-first</div>
      </div>
    </div>
    <nav class="nav">
      ${NAV.map((n) => `
        <a href="${n.id}.html" class="${activeId === n.id ? "active" : ""}">
          <span style="width:18px;text-align:center;opacity:.8">${n.icon}</span>
          <span>${n.label}</span>
          <span style="flex:1"></span>
          <span class="dot"></span>
        </a>`).join("")}
    </nav>
    <div style="position:absolute;bottom:20px;left:18px;right:18px">
      <a href="privacy.html" style="color:var(--text-mute);font-size:12px;text-decoration:none">🔒 Privacy policy</a>
    </div>
  `;
}
