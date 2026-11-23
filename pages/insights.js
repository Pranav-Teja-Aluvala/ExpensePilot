import { mountLayout } from "./_layout.js";
import { get, KEYS } from "../utils/storage.js";
import { spendingInsights } from "../utils/spendingInsights.js";

await mountLayout("insights");
const transactions = await get(KEYS.TRANSACTIONS, []);
const container = document.getElementById("insights");

for (const item of spendingInsights(transactions || [])) {
  const card = document.createElement("article");
  card.className = "card";

  const insight = document.createElement("div");
  insight.className = "insight";

  const badge = document.createElement("div");
  badge.className = "insight-badge";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = item.icon;

  const text = document.createElement("div");
  const title = document.createElement("h4");
  title.textContent = item.title;
  const body = document.createElement("p");
  body.textContent = item.body;
  text.append(title, body);
  insight.append(badge, text);
  card.append(insight);
  container.append(card);
}
