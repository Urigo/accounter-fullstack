---
'@accounter/email-ingestion-gateway': patch
---

Stop the email body→PDF render from hanging on remote assets, and keep it off the network entirely.

`html-to-pdf.ts` waited for `networkidle` with no explicit timeout. `networkidle` needs 500 ms with
zero open connections, which a marketing body full of tracking pixels and beacons never reaches — so
Playwright's default 30 s timeout expired, the render threw, and `treatment.ts` dropped the document.
For an unrecognised business the body is often the *only* document, so the email then quarantined as
`NO_DOCUMENTS`. One observed message spent ~31 s of its 43 s in this render, on a path where the
Cloudflare Worker is holding an open HTTP request.

- Every remote subresource is now aborted through `page.route()`. The render is a static document, so
  there is nothing to wait for; and no `<img src>` from an untrusted body is fetched from the
  gateway's IP any more, which also stops confirming delivery to senders' tracking endpoints. None of
  `link-fetcher.ts`'s SSRF guards applied to a Chromium-issued request, so this closes that gap too.
- `setContent` waits for `domcontentloaded` with an explicit timeout, followed by a best-effort
  `load` that cannot fail the render. `load` alone would not have been enough — measured against a
  host that accepts the connection and never answers, both `networkidle` and `load` burn the full
  timeout while `domcontentloaded` settles in ~20 ms.
- `inline-css` ran with `applyLinkTags` on, which made it fetch every `<link rel=stylesheet>` href
  itself, unbounded, and *throw* when one failed — a second way an unreachable host in the body could
  drop the document, before Chromium was even involved. It is now off; `removeLinkTags` already
  stripped those tags from the render, so only styling the body declined to inline is lost.
- All of it is capped by a single `RENDER_TIMEOUT_MS` (5 s), set as the page's default timeout as
  well as on the explicit waits, so one pathological body cannot dominate an email's processing time.

Measured on the reported body shape, the render goes from a 30 s timeout that lost the document to
~120 ms that produces it.
