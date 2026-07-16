---
"@accounter/client": patch
---

Stop the documents table (reused under the charge extended-info panel) from re-rendering and
"blinking" every time a document is updated. Updating a document refetches the parent charge query,
which yields a fresh documents array even when the content is unchanged. The table now wraps its
incoming `documentsProps` in the shared `useStableValue` hook, so it keeps a deeply-equal-stable
reference and only rebuilds its rows when the documents actually changed.
