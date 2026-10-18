---
'@accounter/scraper-app': minor
---

**Breaking:** the vault is no longer stored on disk. The app opens your vault file in memory for
the session, and you save changes back to it from the UI (in place in Chromium browsers, as a
download elsewhere). A banner shows whenever the session has changes that your file doesn't.
`VAULT_PATH` and the vault-location setting are gone; open your existing `.vault` file once from
the new welcome screen. Run history is now kept for the session only unless you turn on "Save run
history" in Settings.
