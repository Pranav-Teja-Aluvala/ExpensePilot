import { mountLayout } from "./_layout.js";
    import { get, KEYS } from "../utils/storage.js";
    import { CATEGORIES } from "../utils/categorize.js";
    import { inr, fmtDate } from "../utils/format.js";

    await mountLayout("transactions");

    const txs = (await get(KEYS.TRANSACTIONS, [])) || [];
    const banks = [...new Set(txs.map((t) => t.bank))];

    const catSel = document.getElementById("fCat");
    CATEGORIES.forEach((c) => catSel.insertAdjacentHTML("beforeend", `<option>${c}</option>`));
    const bankSel = document.getElementById("fBank");
    banks.forEach((b) => bankSel.insertAdjacentHTML("beforeend", `<option>${b}</option>`));

    const state = { page: 1, per: 15 };

    function filtered() {
      const q = document.getElementById("q").value.trim().toLowerCase();
      const c = catSel.value, b = bankSel.value, ty = document.getElementById("fType").value;
      const mn = +document.getElementById("fMin").value || 0;
      const mx = +document.getElementById("fMax").value || Infinity;
      const from = document.getElementById("fFrom").value;
      const to = document.getElementById("fTo").value;
      return txs.filter((t) => {
        if (q && !t.merchant.toLowerCase().includes(q)) return false;
        if (c && t.category !== c) return false;
        if (b && t.bank !== b) return false;
        if (ty && t.type !== ty) return false;
        if (t.amount < mn || t.amount > mx) return false;
        if (from && new Date(t.date) < new Date(from)) return false;
        if (to && new Date(t.date) > new Date(to + "T23:59:59")) return false;
        return true;
      });
    }

    function render() {
      const list = filtered();
      const total = list.length;
      const pages = Math.max(1, Math.ceil(total / state.per));
      if (state.page > pages) state.page = pages;
      const slice = list.slice((state.page - 1) * state.per, state.page * state.per);
      document.getElementById("countLine").textContent = `${total} transactions`;
      document.getElementById("tbody").innerHTML = slice.length ? slice.map((t) => `
        <tr>
          <td>${fmtDate(t.date, { year: true })}</td>
          <td style="font-weight:600">${t.merchant}</td>
          <td><span class="pill pill-cat">${t.category}</span></td>
          <td><span class="bank-chip">${t.bank}</span></td>
          <td><span class="pill ${t.type === "Credit" ? "pill-credit" : "pill-debit"}">${t.type}</span></td>
          <td style="text-align:right;font-weight:600" class="currency">${t.type === "Credit" ? "+" : "-"}${inr(t.amount)}</td>
          <td style="text-align:right;color:var(--text-dim)" class="currency">${inr(t.balance || 0)}</td>
        </tr>`).join("") : `<tr><td colspan="7"><div class="empty"><h3>No matches</h3><p>Try clearing filters.</p></div></td></tr>`;
      document.getElementById("pinfo").textContent = `Page ${state.page} of ${pages}`;
    }

    ["q","fCat","fBank","fType","fMin","fMax","fFrom","fTo"].forEach((id) => {
      document.getElementById(id).addEventListener("input", () => { state.page = 1; render(); });
    });
    document.getElementById("prev").onclick = () => { if (state.page > 1) { state.page--; render(); } };
    document.getElementById("next").onclick = () => { state.page++; render(); };
    render();