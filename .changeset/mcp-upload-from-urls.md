---
'@accounter/server': patch
'@accounter/mcp-server': patch
---

Upload documents by URL, so the bytes stop travelling through the model.

Inline base64 made the *model* the transport for every uploaded document, and that is the wrong
place for a financial record to pass through: base64 has no redundancy, so a single mis-emitted
character corrupts the file, and a 277KB PDF costs on the order of 100k output tokens before any
server-side limit is even consulted. In practice the tool could only carry files small enough to be
uninteresting.

**Server: `batchUploadDocumentsFromUrls(urls, chargeId, isSensitive)`.** The server fetches each URL
and hands the result to the existing `getDocumentFromFile`, so Cloudinary upload, OCR, hashing, and
charge attachment are unchanged. Results are positional — one entry per input URL — so a partial
failure names the URL that failed instead of sinking the batch.

A server that fetches caller-supplied URLs is an SSRF primitive unless it is guarded, so
`fetch-remote-document.helper.ts` refuses loopback, private, link-local (including the cloud metadata
address), and carrier-grade-NAT ranges, plus `localhost`/`.local` by name and any non-http scheme.
Redirects are followed **manually** and re-validated at every hop: checking only the submitted URL is
the classic way this guard is bypassed, since the redirect target is attacker-controlled too. Bytes,
redirects, and wall-clock time are all capped. The content type is taken from the *response*, never
from the URL's extension — a `.pdf` link that answers with `text/html` is a login page, and storing
it would file a web page as a financial record.

Google Drive share links are routed through `GoogleDriveProvider`, which gains `isFileUrl` and
`fetchFileFromUrl`. This is not optional politeness: `/file/d/<id>/view` returns an HTML page rather
than the file, so a plain fetch would store the page. Going through the Drive API also reads files
shared to the account rather than only public ones.

**MCP: `documentUrls` on `accounter_upload_documents`.** Exactly one of `documentUrls` or
`documents` per call, enforced by a schema refinement so the model gets one clear message rather than
a pair of "no variant matched" branches. The URL branch has no size cap — the inline caps exist
solely because base64 rides in the model's output, which a URL does not. The tool description now
names URLs as the preferred path and inline base64 as the small-content fallback, and the over-size
error points at `documentUrls` instead of merely reporting a number, so the model's next move is a
link rather than a re-encoded, degraded copy of the receipt. The audit line records only
`documentUrlsCount`, never the URLs themselves, which can carry access tokens.
