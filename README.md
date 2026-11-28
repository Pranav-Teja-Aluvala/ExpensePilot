# ExpensePilot

A local browser ledger for reviewing bank statement activity. Import a CSV, check transactions and running balances, and explore monthly cash flow and categorized spending.

## Run the statement ledger

Use Node.js 22 or newer. From the repository root:

```sh
node scripts/serve-web.mjs
```

Open [127.0.0.1:4175/web/](http://127.0.0.1:4175/web/) and choose **Try a demo statement**. The synthetic demo has 24 transactions across two months. Use **CSV format** to download the same sample and try the file picker.

### Supported CSV format

| Column | Expected values |
| :--- | :--- |
| `Date` | `YYYY-MM-DD`, `DD/MM/YYYY`, or `DD-MM-YYYY` |
| `Description` | Transaction narration |
| `Debit`, `Credit` | A positive INR amount in one column, with the other blank or zero |
| `Balance` | Optional running INR balance after the row |
| `Reference` | Optional bank transaction reference |

Use UTF-8 and oldest-first ordering. Quote amounts with thousands separators. Each file can contain up to 2 MiB and 2,000 records. This version supports the documented CSV schema. Bank-specific layouts, Excel, PDF, and scanned files are future work.

### How it works

- A browser worker parses the file, checks rows, and reconciles successive reported balances in integer paise. The preview shows rejected records, balance differences, and possible overlaps.
- The app fingerprints the file per account nickname. Use the same nickname for statements from the same account. An exact repeat stays out of the ledger, while uncertain matches can be selected during review.
- The dashboard separates cash inflow and outflow from debits classified as spending. The transaction table shows each classification reason and the source record. Corrections can become exact-description rules for future imports.
- IndexedDB stores ledger rows, file fingerprints, and saved rules in the browser. Statement parsing and review make no outbound requests. The local server serves bundled assets. Backup and restore are available under **Local data and backups**. Backups contain transaction details, and clearing browser data can remove the ledger.

Run all current tests with `node --test`.

## Gmail extension prototype

A Chrome extension prototype for organizing bank-transaction emails into a local expense dashboard. It includes a demo-data mode and a Gmail import workflow.

## Try it

```bash
git clone https://github.com/Pranav-Teja-Aluvala/ExpensePilot.git
```

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select the repository root, which contains `manifest.json`.
3. On the welcome page, choose **Explore with demo data**. This loads generated transactions; Gmail access is not required for the demo.

Use the root version. The nested `expensepilot/` directory is an older copy with inline page scripts, which conflict with the extension's content-security policy.

## Implemented

- Dashboard, transaction list, category charts and monthly trends.
- CSV/JSON export and JSON import.
- Bank-email parsers for SBI, HDFC, ICICI, Axis, Kotak and Union Bank.
- Merchant normalization, parse-confidence scores and duplicate checks.
- Gmail synchronization through a background service worker.
- Browser-local transaction storage and settings.

## Gmail setup

The manifest contains a Chrome-extension OAuth client ID. For your own installation, configure an OAuth client for your extension ID and replace `oauth2.client_id` in `manifest.json`. The requested Gmail scope is `gmail.readonly`; the extension also uses browser storage, identity, alarms and notification permissions.

Gmail import needs a compatible OAuth configuration. Parser coverage depends on bank-email formats and has not been validated across real accounts here.

## Current limits

- Several dashboard comparisons and insight messages are placeholders.
- Ollama integration is not implemented. The insights page currently combines calculated summaries with fixed text.
- Automated test coverage is limited to the SBI card debit regression. The duplicate source tree still needs consolidation.

Transactions are stored locally. Gmail import makes requests to Google's services; this is not an offline-only application. No separate application backend is included.

The main code is in `pages/`, `scripts/background.js` and `utils/`. Charts use the bundled Chart.js library.


## Run the parser regression test

From the repository root, run this command with Node.js 22 or newer:

```sh
node --test tests/sbi-card-debit.test.mjs
```

The test checks that an SBI card alert is parsed using the debit amount and merchant when the available balance appears first.
