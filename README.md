# The V Fi

Static PWA, no build step. Serve the folder over HTTPS (or localhost).

- `index.html` shell, CSP · `style.css` · `core.js` pure money/date logic + sanitising + schema migrations
- `store.js` IndexedDB, AES-GCM encryption, snapshots, backups, biometrics · `ui.js` dialogs, modal a11y
- `features.js` lock/PIN, backups UI, onboarding, weekly review, safe-to-spend, trends, update flow · `app.js` views
- `sw.js` offline cache, update prompt, background reminders · `tests/` unit tests (`npm test`) and a browser test (`python3 tests/e2e.py`)

**Release:** bump `V` in `sw.js` every time you change any file, or users will not get the update prompt.
