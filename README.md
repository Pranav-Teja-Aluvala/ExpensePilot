# ExpensePilot

**Your bank alerts, organized into a spending dashboard.**

ExpensePilot is a Chrome extension that imports transaction alerts from Gmail, groups them by merchant and category, and shows what changed this month. On a fresh install, the dashboard starts empty and fills in as matching alerts are imported.

## Connect Gmail

1. Clone this repo or download and extract the source.
2. In Chrome, open `chrome://extensions`, enable **Developer mode**, and select **Load unpacked**. Choose the folder with [manifest.json](manifest.json).
3. Copy the installed extension ID. In your Google Cloud project, enable the Gmail API, configure the OAuth consent screen, and create a **Chrome Extension** OAuth client bound to that ID. If the app is in testing, add your Google account as a test user.
4. Set `oauth2.client_id` in `manifest.json` to your client ID, then reload the extension in Chrome. Open **Settings → Connect Gmail** and authorize read-only access.
5. The first scan searches up to 90 days of matching alerts. Later scans check for newer alerts automatically while Chrome is running. Use **Scan now** to retry or check for new alerts.

The client in the checked-in manifest may belong to a different extension ID. An unpacked installation needs a matching OAuth client. Chrome manages the access token.

## What you see after a scan

| View | What it shows |
| --- | --- |
| Dashboard | Recorded debits, credits, net cash flow, largest expense, and recent activity |
| Spending Insights | The top category and spending comparisons through the same calendar day in both months |
| Transactions | Imported alerts, with filters for date, bank, amount, and category |
| Settings | Bank selection, scan frequency, connection status, and JSON backup and restore |

**Supported banks** include SBI, HDFC, ICICI, Axis, Kotak, and Union Bank. The Gmail search narrows results to matching senders and transaction subjects. Recognized alerts are parsed in the extension, normalized, deduplicated by Gmail message ID, and saved in Chrome storage. A short alert excerpt may be included in the stored row.

Gmail grants mailbox-level read-only access. ExpensePilot uses that access to search for bank alerts and read matching results. Bank templates vary, and only recognized formats are imported. Review the results alongside your bank statement.

## Development

Use Node.js 24 and run `node --test`. The tests cover all six parsers with synthetic test fixtures, retry and pagination behavior against a mocked Gmail API, duplicate detection, and the spending calculations. The installed extension generates no sample transactions.
