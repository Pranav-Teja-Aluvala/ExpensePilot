# ExpensePilot

Privacy-first Chrome extension that auto-tracks expenses by parsing bank
transaction emails from Gmail. Everything is stored locally in your browser.

## Install (unpacked)

1. Download and unzip `expensepilot.zip`.
2. Open `chrome://extensions` in Chrome / Edge / Brave.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped `extension/` folder.
5. Pin the extension. Click the icon → **Open Dashboard**.

## Enable real Gmail scanning

1. Create an OAuth 2.0 Chrome-extension client in Google Cloud Console.
2. Add scope `https://www.googleapis.com/auth/gmail.readonly`.
3. Copy the client ID into `manifest.json` (`oauth2.client_id`).
4. Reload the extension and click **Connect Gmail**.

## Folder structure

```
extension/
├── manifest.json
├── assets/          # icons
├── pages/           # welcome, popup, dashboard, analytics, transactions, insights, settings, privacy
├── scripts/         # background service worker
├── styles/          # main.css (glassmorphism dark theme)
├── utils/           # storage, categorize, stats, format, mockData
└── vendor/          # Chart.js (bundled locally, MV3-compliant)
```

## Privacy

- Email contents are never stored or uploaded.
- Only extracted fields (date, amount, type, merchant, bank, balance) are kept.
- All data lives in `chrome.storage.local` and never leaves the browser.
