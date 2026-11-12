---
name: review-pr
description: >-
  Review a GitHub pull request in this repo and post the findings as one batched COMMENT review with
  inline comments and suggestion blocks, after the user approves the draft. Use whenever the user
  asks to review, look over, or leave comments on a PR (by number, URL, or "this branch's PR"), even
  if they don't say "inline" or "post" (e.g. "review 4810", "go over the balances PR and leave
  comments", "/review-pr 4810").
argument-hint: <pr-number-or-url>
---

Review PR `$ARGUMENTS` and post the result as a single COMMENT review. If no PR was given, use the
current branch's PR (`gh pr view --json number`). If given a URL, use its number for `<n>` below;
`gh api` and `git fetch origin` resolve against this checkout's repo, not the URL's.

The review is public and pings the author, so the bar is: every finding is real, points at the right
line, and nothing is posted until the user has seen the exact draft and said yes. The repo is public
too: never quote production data in it (real amounts, client or vendor names, email addresses,
tenant aliases) or anything from local logs. Describe the case instead.

## 1. Read the PR

```bash
gh pr view "$ARGUMENTS" --json number,title,body,author,baseRefName,headRefName,headRefOid,files,url
gh pr diff "$ARGUMENTS" > "$SCRATCH/pr.diff" # $SCRATCH = your scratchpad directory
```

Keep `headRefOid` — it becomes `commit_id`, so the comments attach to the commit you actually
reviewed even if the author pushes meanwhile. Right before posting, check it's still the head
(`gh pr view <n> --json headRefOid`): branches here are often rebased and force-pushed, which can
drop the reviewed commit from the PR. If it moved, tell the user before posting.

Read the PR description for intent: a finding that contradicts a stated, deliberate decision is
usually a question, not a bug. Read the existing review threads too
(`gh api --paginate "repos/{owner}/{repo}/pulls/<n>/comments"`): don't repeat what another reviewer
already raised, and don't reopen a point the author already answered unless you have something new.

To read full files at the PR head, don't check the branch out over the user's working tree. Fetch it
read-only instead:

```bash
git fetch origin "+pull/<n>/head:refs/review/<n>" # then: git show refs/review/<n>:<path>
```

A named ref, not `FETCH_HEAD`: step 2 fetches more (a stacked PR's base branch, a follow-up PR's
head), and each fetch overwrites `FETCH_HEAD`. The `+` lets a re-review pick up a force-push. Remove
the ref when done: `git update-ref -d refs/review/<n>`.

## 2. Look beyond the diff

A diff only shows what changed; most real bugs live at the seams. Before writing findings:

- **Callers and implementers** of anything whose signature, return shape, nullability or semantics
  changed — grep the repo at the PR head (`git grep <pattern> refs/review/<n>`). A renamed GraphQL
  field or a provider method that now returns `null` matters at every call site, including the
  client.
- **Follow-up PRs that consume new APIs.** If the PR adds a function, field, or tool that something
  else will use, find those PRs: `gh pr list --base <headRefName>` (stacked PRs) and
  `gh pr list --search "<new symbol>" --state open`. A new API that its first consumer can't use as
  written is a finding on _this_ PR.
- **Repo conventions** that apply to the touched area: root `CLAUDE.md`,
  `packages/<name>/CLAUDE.md`, `.claude/rules/*.md`, and the checklist in
  `.claude/agents/code-reviewer.md` (DI via `context.injector.get`, DB only in providers,
  `@Injectable({ scope: Scope.Operation, global: true })`, `.js` import suffixes, DataLoader for
  N+1, schema change ⇒ `yarn generate` + migration, etc.).
- **Where past reviews here found real bugs**:
  - Tenant scope: the RLS read scope can span several businesses, so a row a loader returns is
    visible but not necessarily owned. Lookups need an explicit owner filter.
  - Ledger amounts: a rate taken from a different date than the counterpart entry used; fallbacks
    such as `?? 1` that book a wrong amount instead of failing; a new required tax category that
    stops booking for tenants that haven't set it; float residue.
  - Error paths: GraphQL error codes lost on the way up, raw DB errors reaching the client.
  - External APIs: paging that skips or repeats rows, silent truncation at a page cap.
  - Transactions: network calls inside an open transaction, `FOR UPDATE` that can't lock rows not
    inserted yet, triggers such as `updated_at` changing columns behind the code's back.
- **Tests**: does the change have them, and do they actually exercise the new branch? CI's
  `Server Tests` already runs the server typecheck and the unit, client and integration tests for
  PRs that touch `packages/**`, so check `gh pr checks <n>` before running anything yourself. To run
  tests locally, the working tree must be at the PR head and `yarn generate` must run first
  (generated types are git-ignored, so they may be another branch's). DB-backed tests need the local
  DB's `POSTGRES_*` passed inline, since the root `.env` may point at a deployed database. Without
  them the global setup only warns (its stack trace shows `assertTestDatabaseIsLocal`) and tests
  that need no database still run, so read the summary, not the trace. If you didn't run them, say
  so in the body.

For a large PR, a first bug-hunt pass with the `code-review` skill (`/code-review <n>`, in a
background agent) is a good start. Treat its output as candidates: verify each against the code,
line numbers included, before it becomes a finding.

Skip what tooling already enforces (Prettier formatting, lint rules CI runs) and generated files. Do
look at `gh pr checks <n>`: for each red check, say in the body whether the PR or the CI
infrastructure caused it (`gh run view <run-id> --job <job-id> --log-failed`). Changes to frozen
packages (`gmail-listener`, `scraper-local-app`, …) are worth flagging on their own.

## 3. Write numbered findings

Each finding has:

- **Number** — stable, so the user can say "drop 3, soften 5".
- **Severity** — one of:
  - `blocker` — wrong results, data loss, security hole, breaks build/deploy, or a migration that
    can't be rolled forward.
  - `major` — a real bug in a plausible path, a missing case, or an API that its consumers can't use
    as written.
  - `minor` — correctness-adjacent: weak error handling, missing test for a new branch, misleading
    name or doc.
  - `nit` — style or taste. Keep these few; a review buried in nits hides the blockers.
- **Location** — `path:line` (or `path:start-end`), where every line is on the **RIGHT side of the
  diff**: an added or unchanged-context line inside a hunk, numbered in the new file. GitHub rejects
  the entire review if even one comment points elsewhere. List the valid lines with:

  ```bash
  node .claude/skills/review-pr/scripts/check-review.mjs --lines < "$SCRATCH/pr.diff"
  ```

  If the problem is at a line outside the diff (e.g. an unchanged caller), anchor the comment on the
  changed line that causes it and name the other location in the text. If there is no sensible
  anchor, put the finding in the review body instead.

- **Body** — what is wrong, the concrete scenario where it bites, and what to do. Write it to the
  author, not about them.
- **Suggestion** (when the fix is local and certain) — a ```suggestion block. It replaces exactly
  lines `start_line..line` (or just `line`), so it must contain the complete replacement text for
  that range with the file's real indentation, not a fragment. If the replacement itself contains
  triple backticks, fence the suggestion with four. Don't suggest when the fix needs changes
  elsewhere too — describe it instead, since a one-click suggestion that leaves the code half-fixed
  is worse than none. Shape it the way Prettier would, since CI runs `prettier:check` and Markdown
  here wraps at 100 columns: edit a scratch copy of the file, then take the lines from
  `yarn prettier --stdin-filepath <path> < <copy>`.

Mark anything you couldn't fully verify as a question ("Is `x` ever null here? If so …") rather than
asserting it. If you find nothing worth raising, say so — an empty review is a valid outcome.

## 4. Show the draft and get approval

First build the payload (format in step 5) and run the checker on it:

```bash
node .claude/skills/review-pr/scripts/check-review.mjs "$SCRATCH/review.json" < "$SCRATCH/pr.diff"
```

`OK` only proves every line is commentable. In a new or heavily rewritten file every line is, so
read the code it prints under each comment and fix any anchor that isn't on the code the comment is
about.

Then show the user, in the terminal:

1. The review body (a short summary: what the PR does, overall take, any findings without an inline
   anchor).
2. The numbered findings, each with severity, `path:line`, the code it's anchored to (from the
   checker's output), the comment text, and any suggestion block exactly as it will be posted.

Then ask whether to post it, and wait. The user may drop, reword, or re-rate findings — apply that
and show the changed parts again if it's more than a trivial edit. Don't post on anything short of a
clear yes; approval of an earlier draft doesn't cover a changed one.

## 5. Post one review

The payload lives in your scratchpad. Severity goes at the start of each comment so the author can
triage:

````json
{
  "commit_id": "<headRefOid>",
  "event": "COMMENT",
  "body": "<review summary>",
  "comments": [
    { "path": "src/a.ts", "line": 42, "side": "RIGHT", "body": "**major** — …" },
    {
      "path": "src/b.ts",
      "start_line": 10,
      "start_side": "RIGHT",
      "line": 12,
      "side": "RIGHT",
      "body": "**minor** — …\n\n```suggestion\n<full replacement for lines 10-12>\n```"
    }
  ]
}
````

Re-run the checker on the approved payload, then post:

```bash
node .claude/skills/review-pr/scripts/check-review.mjs "$SCRATCH/review.json" < "$SCRATCH/pr.diff"
gh api --method POST "repos/{owner}/{repo}/pulls/<n>/reviews" --input "$SCRATCH/review.json"
```

(`gh api` fills in `{owner}/{repo}` from the current repo.)

- `event` is always `COMMENT`. Approving or requesting changes is the user's call, made in the
  GitHub UI.
- One POST, all comments in it — not a comment per finding, which spams the author with
  notifications.
- Write code identifiers in backticks and don't put a bare `@name` in the text: GitHub notifies
  whoever that login is.
- `422 … one pending review` means the user already has a draft review open on this PR. Tell them;
  don't delete it for them.
- Any other 422 almost always means a bad line. Re-run the checker, fix, and post again — the failed
  call posted nothing.

Finish by giving the user the review's `html_url` from the response.
