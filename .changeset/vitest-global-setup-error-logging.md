---
---

Stop the vitest global setup from crashing the whole run when the test database is unreachable. Its
non-fatal warnings printed the caught `Error`, and formatting that error's stack crashed Vite's
source mapping (`code.charCodeAt is not a function`), which aborted every project with "No test
files found" and hid the real cause. The warnings now print only the error message, so tests that
don't need the database (fully mocked unit tests) run without one, as the README describes.
Test tooling only; no release.
