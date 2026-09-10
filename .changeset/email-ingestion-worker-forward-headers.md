---
'@accounter/email-ingestion-gateway': patch
---

Stamp `X-` headers on every forwarded copy so a message in the destination mailbox can be told apart
and joined back to the gateway logs.

The Worker forwards each message to `EMAIL_FORWARD_DESTINATION` before calling the webhook, and to
`FALLBACK_EMAIL` when the gateway is unreachable or refuses. The MIME is passed through untouched,
which is deliberate — but it means the copy's `To:` still shows the tenant alias and nothing in the
message names the mailbox it was routed to, or which of the two paths produced it. An operator
looking at the destination inbox could not tell an ordinary archive copy from one that landed there
because ingestion had failed.

`forward()` takes an optional `Headers` argument, of which the runtime keeps only `X-`-prefixed
entries. Every copy now carries `X-Accounter-Forward` (`archive` / `fallback`),
`X-Accounter-Correlation-Id` and `X-Accounter-Recipient`, and a fallback copy additionally carries
`X-Accounter-Fallback-Reason` and `X-Accounter-Gateway-Status`.

The correlation id is the point of the change, and it needed the id to exist earlier than it did:
the nonce was minted just before the webhook call, i.e. *after* the archive forward, so that copy
had nothing to carry. It is now generated once at the top of `email()` and reused as the nonce, so
the archive copy, the fallback copy, the `worker:*` lines and the gateway's `orchestrate:*` lines
all share one id. A test asserts the header matches the `correlationId` the gateway actually
received — an id that does not match would be worse than none.

Note that Gmail cannot search or filter on custom headers, so these serve _Show original_ and
IMAP/API clients. For Gmail filtering, give each path its own plus-tagged destination: the tag is
the SMTP envelope recipient and the receiving server stamps it into `Delivered-To:`, which Gmail
does index. Both mechanisms are documented in the package README.

Also corrects a comment that claimed the runtime rejects a second forward to an already-used
address. Cloudflare does not document that. The guard that skips the fallback forward when both
destinations are equal stays — a second copy to the same mailbox adds nothing, and skipping is
idempotent either way — but it no longer rests on a guarantee that was never verified.
