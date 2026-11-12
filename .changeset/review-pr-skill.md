---
---

Add a `review-pr` Claude Code skill (`.claude/skills/review-pr`). It reviews a pull request, shows the
numbered findings for approval, and posts them as one batched `COMMENT` review with inline comments and
`suggestion` blocks. A bundled `check-review.mjs` script checks every comment against the right-hand
side of the PR diff before posting, since GitHub rejects the whole review if any line is outside it.
