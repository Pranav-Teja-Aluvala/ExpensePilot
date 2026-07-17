# ExpensePilot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

ExpensePilot is a privacy-first browser extension that tracks expenses by reading supported bank transaction emails from Gmail.

Instead of manually entering every expense, the extension imports transaction data, categorizes spending, generates analytics, and provides financial insights. All processing happens locally on your device. Emails are never permanently stored, and only normalized transaction data is kept inside the browser storage.

## Features

- **Automatic Gmail import**: Syncs transaction emails in the background.
- **Google OAuth**: Secure authentication via the Chrome Identity API.
- **Gmail Readonly**: Requests only the minimum necessary permissions.
- **Bank parsers**: Built-in support for multiple Indian banks.
- **Merchant engine**: Recognizes and normalizes merchant names.
- **Automatic categorization**: Maps transactions to standard categories.
- **Confidence scoring**: Flags potentially inaccurate parses.
- **Analytics & Dashboard**: Interactive charts, weekly, and monthly reports.
- **Data export**: Export your data to CSV or JSON.
- **Local-first storage**: No external databases.
- **Ollama ready**: Upcoming integration for local AI insights.

## Tech Stack

**Frontend**
- HTML / CSS / JavaScript (ES Modules)
- Chart.js

**Backend / Integration**
- Google OAuth & Gmail API
- Chrome Extension APIs (Manifest V3)
- Python (future analytics/report generation)
- Ollama (planned)

**Storage**
- Chrome Storage API
- JSON

## Project Structure

- `assets/` - Icons and static images
- `pages/` - UI views (Dashboard, Settings, Transactions, etc.)
- `scripts/` - Background service workers
- `styles/` - Vanilla CSS styles
- `utils/` - Core logic including storage, formatters, and API clients
  - `parsers/` - Bank-specific regex parsers and registry
- `vendor/` - Third-party libraries (Chart.js)

## How It Works

User installs extension
↓
Connect Gmail
↓
Google OAuth
↓
Read supported bank emails
↓
Parse transactions
↓
Normalize data
↓
Store locally
↓
Generate analytics
↓
Display dashboard

## Privacy

- Emails are not uploaded to any external server.
- Bank credentials are never accessed or requested.
- Only the `gmail.readonly` permission is requested.
- Everything is processed locally in the browser sandbox.

## Future Improvements

- PDF Statement Import
- CSV Import
- Budget Planner
- Investment Tracking
- Recurring Payments
- AI Financial Assistant
- Multi-account support

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

MIT
