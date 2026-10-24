# ExpensePilot

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
- There is no automated test suite, and the duplicate source tree still needs consolidation.

Transactions are stored locally. Gmail import makes requests to Google's services; this is not an offline-only application. No separate application backend is included.

The main code is in `pages/`, `scripts/background.js` and `utils/`. Charts use the bundled Chart.js library.

