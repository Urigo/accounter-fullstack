---
'@accounter/mcp-server': patch
---

Harden connection-dropout observability so idle spin-downs, cold starts, and
client disconnects are diagnosable from the server side, and split token expiry
from other auth failures.

- Log the previously-silent `missing_token` 401 (with a `category` field) so
  tokenless reconnect probes are visible instead of a blind spot.
- Meter `expired_token` separately from `invalid_token`: `TokenVerificationError`
  now carries an `expired` flag derived from jose's `ERR_JWT_EXPIRED`. The
  transport response is unchanged (RFC 6750 `invalid_token` + `WWW-Authenticate`);
  only the metric bucket and log `category` differ, distinguishing "clients
  should refresh" from "tokens are misconfigured/abused".
- Add `aborted`/`responseCompleted` (from `res.writableFinished`, so a
  disconnect after `end()` but before the flush completes is not miscounted as
  completed) and `uptimeSeconds` to completion logs, `msSinceLastRequest` to
  request-start logs, and `pid` to the startup log.

Observability-only: no change to tools, transport behavior, or auth decisions.
