# `@accounter/opcn1214-generator` — Implementation Plan

Audience: the tech lead driving the build, and the coding agent(s) executing it. Companion to
[`SPEC.md`](SPEC.md) (the _what_); this document is the _how_ and _in what order_.

- **Part 1** — blueprint: the architecture as it will be built, the internal contracts every step
  relies on, and the deltas this plan makes to the spec.
- **Part 2** — how the work was sliced (three rounds of breakdown) and the resulting step map.
- **Part 3** — the prompts: one self-contained, test-driven instruction block per step, in order.
  Every block is fenced as `text` so it can be pasted into an agent unchanged.

---

## Part 1 — Blueprint

### 1.1 Shape of the system

```
Report1214Input ─► shape (zod) ─► normalize ─► NormalizedReport ─► rule engine ─► (no errors) ─► assemble file ─► bytes
                                                    ▲                                                    │
OPCN file ─► split lines ─► decode records ─────────┘ ◄──────────────── same codecs ─────────────────────┘
                                 │
                                 └─► denormalize ─► canonical Report1214Input
```

Three ideas carry the whole design:

1. **The layout is data.** `documentation/layout/<year>/*.csv` → generated `as const` TypeScript.
   Field order, widths, kinds, allowed values and code tables are never hand-coded twice.
2. **Paired codecs.** Every field kind has one `Codec` with `encode` and `decode`. A generic record
   codec walks the layout. Generation and parsing therefore share one implementation, and the round
   trip is testable from the very first primitive.
3. **One internal model.** `NormalizedReport` sits between the public input and the bytes. The
   normalizer (input → model) and denormalizer (model → input) are the only code that knows the
   public input shape; codecs, rules and file assembly only see the model.

### 1.2 Internal contracts (fixed by early steps, relied on by all later ones)

```ts
// src/codec/types.ts — created in B1
export type Primitive = string | number | boolean | undefined

export interface FieldShape {
  length: number
  type: 'numeric' | 'alphanumeric'
  kind: FieldKind | CodeKind
  values?: readonly EnumValue[]
}

export interface Codec {
  /** Returns exactly `shape.length` characters. Throws Opcn1214InternalError for a value that
   *  validation should have rejected (encoders never repair data). */
  encode(value: Primitive, shape: FieldShape): string
  /** Inverse of encode. All-zero numeric text decodes to 0 and all-space text to undefined; the
   *  record codec (B4) decides whether 0 means "absent" (it does for non-required header fields,
   *  except amountX). Throws CodecDecodeError for raw text that cannot be decoded; the parser
   *  converts it into a parse.* issue. */
  decode(raw: string, shape: FieldShape): Primitive
}

export class CodecDecodeError extends Error {
  readonly reason: 'numeric' | 'date' | 'format' | 'section' | 'length'
  readonly offset: number // 0-based offset within the decoded text (field, section or line)
}

// src/normalize/paths.ts — created in C1, shared by the normalizer and the parser (C7b)
export function pathFor(recordType: RecordType, inputIndex: number, key: string): string

// src/model/normalized.ts — created in C1
export interface NormalizedRecord {
  recordType: RecordType
  index: number // 0-based among records of the same type
  values: Record<string, Primitive> // FieldDef.key → value (derived keys included)
  codes: Map<string, number> // code-amount section, natural units
  countries: Array<{ country: string; income: number }> // 2200 only, otherwise []
  paths: Record<string, string> // key | `code:${code}` | `countries[${i}]` → input path
}

export interface NormalizedReport {
  taxYear: number
  layout: YearLayout
  records: NormalizedRecord[] // canonical order (SPEC §3.3), 9999 excluded
  notices: Issue[] // raised while normalizing (e.g. phone prefix dropped)
  omittedZeroCodes: Array<{ record: RecordType; recordIndex: number; code: string }>
}

// src/pipeline.ts — created in C3 (year stage included), extended in C5 (shape stage)
export function runPipeline(
  input: unknown,
  options?: ValidateOptions
): { report?: NormalizedReport; issues: Issue[] } // issues sorted (SPEC §9.1)
```

Value conventions inside `NormalizedRecord.values` (by kind):

| Kind(s)                                                                        | Value type in the model                       |
| ------------------------------------------------------------------------------ | --------------------------------------------- |
| `text`, `hebrewText`                                                           | normalized `string` (SPEC §4.3)               |
| `id9`, `shareholderId`, `digits`                                               | digit `string` (kept as string)               |
| `num`, `year`, `count`, `serial`, `const`, `foreignCode`, `enum`               | `number` (enums already mapped to their code) |
| `amount`, `amountX`, `amountX100`, `rateX100`, `percentX100`, `percentLiteral` | `number` in natural units (ILS, percent)      |
| `date`                                                                         | ISO `YYYY-MM-DD` `string`                     |
| `flag`, `yesNo`                                                                | `boolean`                                     |
| `phonePrefix`                                                                  | prefix `string` (`'052'`)                     |
| `filler`                                                                       | never stored                                  |
| any kind, absent                                                               | `undefined`                                   |

A value that failed a type conversion in the normalizer (e.g. `'12a'` for a numeric field) is kept
**as the raw input** so the field rules report it; encoders are never reached with it because
generation stops on errors.

Facts that exist in the input but have no field of their own (a 6th reportable position, an explicit
`hasCapitalGainsAppendix: false` while appendices exist, an invalid phone prefix that is dropped)
are reported by the normalizer as `notices` with the rule ID that owns them; the engine merges
notices with the other stages.

### 1.3 Spec changes made with this plan

All rows below are **already applied** to `SPEC.md` (and D-13 to `layout/2024/fields.csv`) in the
same commit as this plan; agents implement the spec as it now reads. The table is the change log.

| #    | Change                                                                                                                                                                                                                                                                                                         | Why                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| D-1  | `src/encode/` + `src/decode/` become `src/codec/` (paired codecs) and `src/file/` (assemble/split lines). `src/pipeline.ts` is added.                                                                                                                                                                          | Shared implementation, round-trip tests per primitive |
| D-2  | The parser ships in Part C (walking skeleton), not in a late phase; each later record slice adds encode **and** decode together.                                                                                                                                                                               | No orphan code; round trip from the first report      |
| D-3  | Canonical form (SPEC §8.4) additions: digit-string inputs mapped to numeric fields are canonicalized to the field width with zero padding (`'12'` → `'012'` for a 3-digit branch); optional numeric header values equal to `0` are absent.                                                                     | Makes `parse(generate(x)) = canonicalize(x)` exact    |
| D-4  | Header fillers are ignored on decode (only the 9–136 prefix is checked, `parse.prefixFiller`); generation always writes zeros/spaces.                                                                                                                                                                          | Tolerant parser, strict generator                     |
| D-5  | `main.kibbutz.code226` splits into `main.kibbutz.code226` (E: kibbutz without code 226) and `main.kibbutz.code226Other` (W: code 226 = 9 while kibbutz). `field.phonePrefix` is W only (the follow-up `field.required` is the error).                                                                          | One severity per rule ID                              |
| D-6  | `cg.code018` is removed; code 018 in 30xx records is covered by `field.enum` (allowed values 23, 50).                                                                                                                                                                                                          | No duplicate rules                                    |
| D-7  | Tests are type-checked by a dedicated `tsconfig.typecheck.json` (`typecheck` script); package tests run with the package Vitest config (the root `unit` project needs Postgres).                                                                                                                               | Type-safe tests, fast local runs                      |
| D-8  | Phase mapping: P0 = Part A, P1 = Parts B–D, P2 = Part E, P3 = Part F, P4 = Part G, P5 + P6 = Part H.                                                                                                                                                                                                           | Plan/spec alignment                                   |
| D-9  | `field.taxYear` is removed: the shape stage only admits supported years and the parser selects the layout from 1000@146, so the rule can never fire.                                                                                                                                                           | Every rule must have a failing case                   |
| D-10 | `struct.section.overflow` is removed: with every code of a record filled, each section still fits (1000: 1295 of 2048; 2000: 765 of 1024; largest 30xx: 273 of 1024). A layout integrity test asserts this per year, and the section encoder keeps its internal-error guard.                                   | Every rule must have a failing case                   |
| D-11 | `struct.foreignCountryRecords.max` is removed: one 2200 record per per-country code and only 23 such codes exist, so input can produce at most 23 (< 30); parsed files exceeding 30 are reported by `parse.occurrences`.                                                                                       | Every rule must have a failing case                   |
| D-12 | Slot-aware `field.required`: a required field inside a repeated slot (`improvements[i].date`, …) is required only when another key of that slot has a value. `cg.improvements.date` is removed (covered).                                                                                                      | Empty slots must not raise errors                     |
| D-13 | New kind `digits` for identifier digit strings stored in numeric fields (phone numbers, withholder branch/account; 27 rows of fields.csv); `num` is numbers only.                                                                                                                                              | `field.phoneNumber` and round trip need the string    |
| D-14 | `field.enum` applies to kinds `enum` and `rateX100` only (special values of `shareholderId`, and `values` of `yesNo`/`flag`/`const`/`phonePrefix`, are documentation, not exhaustive lists). `field.charset` owns the "no control characters" check; the windows-1255 helper checks code-page membership only. | Precise rule scope; CRLF is encodable                 |
| D-15 | Parser: only maximum occurrences are enforced (`struct.shareholders.min` handles the minimum); an unsupported year in a file is `struct.taxYear.unsupported`. Goldens are committed PENDING with their sha256 in `VERIFICATION.md`, asserted by the golden test. RuleCase kinds `input`, `file`, `batch`.      | Kibbutz files parse; goldens cannot change silently   |
| D-16 | The zod schema accepts any string for phone prefixes and country codes (rules check them); unknown/derived code keys are reported before zod and removed; `unrecognized_keys` becomes one `input.shape` issue per key; path segments that are not identifiers use `["…"]`.                                     | Rules stay reachable; no double reports               |

### 1.4 Plan review record

An independent review (23 findings) was applied: blockers fixed — CRLF vs. the windows-1255 helper
(B2), the `RuleId` circular type (C3), `struct.taxYear.unsupported` ordering (C3),
schema-unreachable rules (C5, F2), empty improvement slots (D-12); majors — `digits` kind (D-13),
decode/optional split (B1/B4), `field.enum` scope (D-14), zod issue mapping (C5/D3, D-16), file-case
semantics and parse paths (C7b), notices for input-only facts (§1.2), `main-full` moved to D5,
generated files ignored by lint and tests run last, file paths via `import.meta.url`, `typecheck` in
CI, C7 split into C7a/C7b, golden sha256 guard, maxima-only parse occurrences; minors folded into
the affected steps.

### 1.5 Test strategy at a glance

- **Unit tests per codec** with round trip (`decode(encode(v)) === v`) and exact-string asserts.
- **Generic layout tests** that run every record type of the year through the record codec with
  sample values (B4) — proves the engine for all 17 record types before any business code exists.
- **Rule cases**: `tests/rules/cases.ts` is typed `{ [K in RuleId]: RuleCase }`, so adding a rule
  without a pass/fail case is a type error; `rules.test.ts` runs every case.
- **Golden files** (`tests/fixtures/golden/*.opcn`, windows-1255 bytes) for byte-level stability,
  each verified once on SHAAM's structure checker by a human (checkpoints in Part 3); their sha256
  is recorded in `VERIFICATION.md` and asserted, so regenerating a golden is always a visible
  change.
- **Round trip** generate → parse → `canonicalize` for every fixture; parse → generate byte equality
  for every golden file; seeded randomized inputs at the end (H3).

---

## Part 2 — Slicing the work

### 2.1 Round 1 — milestones

| Milestone | Outcome                                                                       |
| --------- | ----------------------------------------------------------------------------- |
| M1        | Layout available as typed data for any supported year                         |
| M2        | Any record of the layout can be encoded and decoded                           |
| M3        | A minimal, real 1214 file can be validated, generated and parsed (public API) |
| M4        | Record 1000 complete with every rule                                          |
| M5        | Related companies and R&D investments                                         |
| M6        | Foreign appendix with country breakdown                                       |
| M7        | All ten capital-gains appendices                                              |
| M8        | Batch, response file, hardening, release                                      |

### 2.2 Round 2 — chunks

M3 was the riskiest milestone ("walking skeleton"), so it was split into model → assembly →
validation framework → field rules → shape → API → parser. M4 was split by input group and by rule
family. M7 was split by appendix family (the ten types share four shapes).

### 2.3 Round 3 — steps, and the sizing check

Every candidate step was checked against these criteria; steps that failed were split or merged:

- **One concept** a reviewer can hold in their head; roughly 150–500 lines of production code.
- **Tests first** and able to fail for the right reason before the implementation exists.
- **Ends integrated**: the new code is reachable from the previous layer's entry point by the end of
  the step (no module that only its own tests import, except the foundation layer in Parts A–B,
  whose consumer is the very next step).
- **Green at the end**: typecheck, tests, lint, prettier and build pass; one commit per step.
- **No forward references**: a step never needs a type or function introduced later.

Adjustments made in this round: the code generator was split (fields vs. codes); codecs were split
into numeric and text/date families; record-1000 work was split into three input groups and two rule
groups; capital gains were split into one framework step plus four family steps; batch and
response-file parsing were separated from parser hardening.

### 2.4 Step map

| Step | Title                                                      | Adds rules                                                                                                                                                                                                                                                                                                  | Golden / checkpoint                    |
| ---- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| A1   | Tooling baseline                                           | —                                                                                                                                                                                                                                                                                                           |                                        |
| A2   | Layout generator v1: records and header fields             | —                                                                                                                                                                                                                                                                                                           |                                        |
| A3   | Layout generator v2: codes, countries, code unions         | —                                                                                                                                                                                                                                                                                                           |                                        |
| A4   | Layout registry, integrity tests, first public exports     | —                                                                                                                                                                                                                                                                                                           |                                        |
| B1   | Codec contract and numeric codecs                          | —                                                                                                                                                                                                                                                                                                           |                                        |
| B2   | Text normalization, windows-1255, text/date/boolean codecs | —                                                                                                                                                                                                                                                                                                           |                                        |
| B3   | Code-amount and country-amount section codecs              | —                                                                                                                                                                                                                                                                                                           |                                        |
| B4   | Record codec and all-records round trip                    | —                                                                                                                                                                                                                                                                                                           |                                        |
| C1   | Skeleton input model and normalizer (1000 core + 1020)     | —                                                                                                                                                                                                                                                                                                           |                                        |
| C2   | File assembly and the 9999 control record                  | —                                                                                                                                                                                                                                                                                                           |                                        |
| C3   | Validation framework, year stage, first field rules        | `struct.taxYear.unsupported` `field.required` `field.numeric` `field.length` `field.charset`                                                                                                                                                                                                                |                                        |
| C4   | Remaining generic field rules                              | `field.integer` `field.decimals` `field.negative` `field.enum` `field.date` `field.percentRange` `field.hebrewFirstLetter` `field.phonePrefix` `field.phoneNumber`                                                                                                                                          |                                        |
| C5   | Shape stage (zod)                                          | `input.shape`                                                                                                                                                                                                                                                                                               |                                        |
| C6   | Public API v1: `validate1214`, `generate1214`              | —                                                                                                                                                                                                                                                                                                           | `minimal` · **CP-1**                   |
| C7a  | Parser v1: happy path and round trip                       | —                                                                                                                                                                                                                                                                                                           |                                        |
| C7b  | Parser v1: structural errors                               | `parse.empty` `parse.encoding` `parse.lineLength` `parse.formType` `parse.recordType` `parse.prefixFiller` `parse.order` `parse.control.missing` `parse.control.counts` `parse.numeric` `parse.date` `parse.codeSection`                                                                                    |                                        |
| D1   | Declarations and preparer                                  | —                                                                                                                                                                                                                                                                                                           |                                        |
| D2   | Other income, attachments, CG summary, qualifying company  | —                                                                                                                                                                                                                                                                                                           |                                        |
| D3   | Derived main codes and code-map guards                     | `input.derivedCode` `input.unknownCode` `struct.mainCodePairs.max` `main.bankAccount.format`                                                                                                                                                                                                                |                                        |
| D4   | Record 1000 conditional requirements                       | `main.familyCompany.*` `main.houseCompany.code084` `main.investmentLaw.flag` `main.beneficiaryEnterprise.noticeDate` `main.specialYear.balanceSheetDate` `main.kibbutz.code226` `main.buildingIncome.code259` `main.cgReasons.otherText` `main.reportablePositions.required` `main.reportablePositions.max` |                                        |
| D5   | Record 1000 warnings and shareholder rules                 | `main.kibbutz.code226Other` `main.reportablePositions.unexpected` `main.cgUntransmitted.*` `main.bankAccount.withNoBank` `main.qualifyingCompany.*` `main.attachments.*` `shareholders.*` `struct.shareholders.min` `struct.shareholders.max`                                                               | `main-full` `kibbutz` · **CP-2**       |
| E1   | Related companies (1010)                                   | `struct.relatedCompanies.max`                                                                                                                                                                                                                                                                               |                                        |
| E2   | R&D investments (1030)                                     | `struct.rdInvestments.max` `main.rd.records` `main.rd.total`                                                                                                                                                                                                                                                | `related-and-rd`                       |
| F1   | Foreign appendix (2000)                                    | `foreign.otherIncome.description` `foreign.refund.amount`                                                                                                                                                                                                                                                   |                                        |
| F2   | Country breakdown (2200)                                   | `foreign.breakdown.*` `parse.countrySection`                                                                                                                                                                                                                                                                | `foreign` · **CP-3**                   |
| G1   | Capital-gains framework + 3063                             | `struct.capitalGains.max` `main.capitalGains.flag` `main.appendixTotal.min`                                                                                                                                                                                                                                 | `cg-63`                                |
| G2   | Securities with withholders: 3060, 3064                    | —                                                                                                                                                                                                                                                                                                           | `cg-60` `cg-64`                        |
| G3   | No-withholding appendices: 3065, 3066                      | —                                                                                                                                                                                                                                                                                                           | `cg-65` `cg-66`                        |
| G4   | Asset appendices: 3027, 3050, 3054, 3051                   | —                                                                                                                                                                                                                                                                                                           | `cg-27` `cg-50` `cg-54` `cg-51`        |
| G5   | Other transactions: 3077                                   | `cg.improvements.max` `cg.improvements.code50Amount` `cg.virtualCurrency.wallet`                                                                                                                                                                                                                            | `cg-77` `capital-gains-max` · **CP-4** |
| H1   | Parser hardening and batches                               | `parse.occurrences` `parse.multipleReports` `parse.derivedMismatch` `struct.batch.size`                                                                                                                                                                                                                     | `batch-50`                             |
| H2   | Response file parser                                       | —                                                                                                                                                                                                                                                                                                           |                                        |
| H3   | Property, determinism and edge-case suite                  | —                                                                                                                                                                                                                                                                                                           | `hebrew-edge`                          |
| H4   | Release wiring                                             | —                                                                                                                                                                                                                                                                                                           | **CP-5**                               |

`CP-n` are human checkpoints (Part 3, after the step that produces the files).

### 2.5 Branching and review

One commit per step (conventional commit message given in each prompt). Recommended: one PR per Part
(A–H), stacked on the spec PR, each reviewed before the next Part starts. A step may be split
further by the agent if it grows beyond the sizing criteria; it must never be merged with the next.

---

## Part 3 — Prompts

### Standing instructions (prepend to every step, or point the agent at this section)

```text
STANDING INSTRUCTIONS — read before every step of the 1214 generator plan

Repository: accounter-fullstack (Yarn 4 monorepo). Package: packages/opcn1214-generator
(@accounter/opcn1214-generator). Specification: packages/opcn1214-generator/documentation/SPEC.md.
Plan: packages/opcn1214-generator/documentation/IMPLEMENTATION_PLAN.md (Part 1 holds the internal
contracts you must respect). Layout data: documentation/layout/2024/*.csv.

Working rules
1. Test-driven: write the tests listed in the step first, run them, see them fail for the expected
   reason, then implement until green. Do not weaken or skip a test to get green.
2. Do only this step. Do not implement anything listed as out of scope or belonging to a later
   step. Do not leave unused exports or dead code; everything you add must be reachable from the
   integration point named in the step's "Wiring" section.
3. TypeScript strict, ES modules only, import paths with the ".js" suffix, no default exports,
   no `any` (use `unknown` and narrow). Pure functions; no I/O in src/ (no fs, no network, no
   process.env); the only clock access is the injectable `today` option.
4. Use yarn only (never npm/npx/pnpm). Add dependencies with exact versions:
   yarn workspace @accounter/opcn1214-generator add --exact <pkg>@<version>
5. Tests live in packages/opcn1214-generator/tests/**, use Vitest globals, import from src/ (never
   dist/). Assert exact substrings of encoded lines at layout positions, e.g.
   line.slice(pos - 1, pos - 1 + len), in addition to any snapshot. Tests that read files (SPEC.md,
   CSVs, generated modules, goldens) resolve paths with new URL('…', import.meta.url): the root test
   runner uses the repository root as its working directory.
6. Never hand-edit generated files (src/layout/*/layout.generated.ts, src/model/codes.generated.ts)
   or golden files (tests/fixtures/golden/*.opcn). Regenerate them with their scripts.
7. If the spec is silent or ambiguous, choose the simplest behaviour consistent with SPEC §15,
   implement it, and record it in SPEC.md (§15 for ambiguities, otherwise the relevant section)
   in the same commit. If the spec is contradicted by real behaviour, stop and report.
8. Keep SPEC.md, RULES (src/validate/rules.ts) and tests/rules/cases.ts consistent: every rule ID
   added in a step exists in all three.

Verify bundle (run at the end of every step, in this order; all must pass)
  yarn workspace @accounter/opcn1214-generator typecheck
  yarn workspace @accounter/opcn1214-generator build        # runs `lint --fix` first, then bob
  yarn eslint packages/opcn1214-generator/src                 # root config, no --fix: the repo-wide lint CI
  yarn prettier --check packages/opcn1214-generator
  yarn workspace @accounter/opcn1214-generator test --run   # last: catches anything lint --fix changed
  git status                                               # lint --fix may have edited files: commit them
(Do not use the root `yarn test`: its global setup requires Postgres.)

Finish every step with one commit using the message given in the step, ending with the
attribution lines your environment requires. Report: what changed, test counts, any spec edits,
and anything you were unsure about.
```

---

### Part A — Foundation: layout as typed data

#### A1 — Tooling baseline and spec deltas

```text
STEP A1 — Tooling baseline and spec deltas
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
The package currently contains only documentation, a placeholder src/index.ts and a `test` script
running `vitest --passWithNoTests`. Tests are not type-checked (tsconfig.json excludes tests/).

Read first
- IMPLEMENTATION_PLAN.md Part 1 (contracts; §1.3 lists spec changes that are already applied)
- SPEC.md §5.2, §5.5, §13.9
- package.json, tsconfig.json, vitest.config.ts of this package; the root tsconfig.json comment on
  `incremental` and CLAUDE.md "TypeScript Build Cache"

Goal
A test/typecheck harness ready for TDD, the runtime and dev dependencies the plan needs, and CI that
runs the type check.

Tests first
1. tests/smoke.test.ts — imports `SPEC_STATUS` from src/index.ts and asserts it equals
   'specification' (proves the harness resolves src/ with .js-suffixed imports).

Implementation
- Dependencies: iconv-lite@0.7.3 (runtime); tsx@4.23.15 and prettier@3.10.1 (dev).
- tsconfig.typecheck.json: extends ../../tsconfig.json; compilerOptions { noEmit: true,
  rootDir: ".", tsBuildInfoFile: "../../node_modules/.cache/tsbuildinfo/opcn1214-generator.tsbuildinfo" };
  include ["src", "tests", "scripts", "vitest.config.ts"].
- package.json scripts: "typecheck": "tsc -p tsconfig.typecheck.json"; "test": "vitest"
  (remove --passWithNoTests); "generate:layout": "tsx scripts/generate-layout.ts" (the script is
  created in A2 — add the script entry in A2 instead if your tooling rejects a missing file).
- .github/workflows/opcn1214-generator-test.yml: add a "Typecheck" step
  (yarn workspace @accounter/opcn1214-generator typecheck) between install and build.

Wiring
- The smoke test runs in `yarn workspace @accounter/opcn1214-generator test --run`.
- `typecheck` covers src, tests and scripts.

Out of scope
Any src/ code beyond the existing placeholder.

Verify
Run the verify bundle. Also confirm `typecheck` fails if you temporarily add a type error to the
smoke test (then remove it).

Commit: "chore(opcn1214-generator): tooling baseline for implementation"

Done when
- The verify bundle passes with one test; the workflow runs typecheck, build and test.
```

#### A2 — Layout generator v1: records and header fields

```text
STEP A2 — Layout generator v1: records and header fields
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
documentation/layout/2024/records.csv and fields.csv describe every record and header field
(SPEC §3.2, §3.4; column reference in documentation/layout/README.md). They are the source of
truth; the runtime layout is generated TypeScript (SPEC §5.3).

Read first
- SPEC §3.2, §3.4, §4.2, §5.3, §5.4; documentation/layout/README.md; the two CSV files.

Goal
`yarn workspace @accounter/opcn1214-generator generate:layout` produces
src/layout/2024/layout.generated.ts with all 17 records and their 270 header fields, and an
internal `getLayout(2024)` returns it.

Tests first
1. tests/scripts/csv.test.ts — RFC-4180 parsing: quoted fields with commas, doubled quotes,
   quoted newlines, CRLF and LF line endings, trailing newline, Hebrew text; header row mapped to
   objects; a row with the wrong number of columns throws with its line number.
2. tests/scripts/values.test.ts — the `values` grammar (`;`-separated items: `n`, `n..m`,
   `n=label`; split each item on the FIRST '=' only): '1=yes;2=no' →
   [{value:1,label:'yes'},{value:2,label:'no'}]; '1..12' → 12 items; '5;8;10;15;115;20';
   '999999964=…;999999998=…'; the 1000@834 value whose label contains '=' ("… (code 297=8)");
   '' → undefined; malformed input throws.
3. tests/layout/codegen-sync.test.ts — renders the module in memory from the CSVs with the same
   function the script uses (including prettier formatting with the repo config) and asserts it
   equals the committed layout.generated.ts.
4. tests/layout/integrity.test.ts (headers part) — for every record of getLayout(2024): fields sorted
   by position, first at 137, contiguous, last field ends at 136 + headerLength; headerLength plus
   sectionLength (if any) plus 136 equals length; keys unique per record; every kind is a FieldKind;
   derived fields are exactly the rows whose CSV key starts with "(derived) ".

Implementation
- src/layout/types.ts — RecordType, FieldKind (SPEC §4.2, including 'digits'), CodeKind
  ('amount'|'amountX100'|'rateX100'|'enum'|'num'), EnumValue, FieldDef (`derived: boolean`; `key`
  without the "(derived) " prefix),
  CodeDef, RecordDef, YearLayout (SPEC §5.4). CodeDef/countries are declared now but stay empty
  until A3 (records get `codes: []`, layout gets `countries: new Map()`).
- scripts/layout/csv.ts — small RFC-4180 parser (no dependency).
- scripts/layout/values.ts — values grammar parser.
- scripts/layout/render.ts — `renderLayoutModule(year, { records, fields }): Promise<string>`
  producing an `as const` module, formatted with prettier.format() using
  prettier.resolveConfig() for the target path.
- scripts/generate-layout.ts — for each documentation/layout/<year>/ directory, read the CSVs, write
  src/layout/<year>/layout.generated.ts. Header comment: "Generated by scripts/generate-layout.ts
  from documentation/layout/<year>/ — do not edit."
- package.json "lint": add --ignore-pattern '**/*.generated.ts' so `lint --fix` (run by `build`)
  never rewrites generated files; the codegen-sync test is the guard.
- src/layout/registry.ts — `getLayout(taxYear: number): YearLayout` for 2024 only for now
  (other years: throw a plain Error; A4 replaces it with the public error class).

Wiring
- registry.ts imports the generated module; integrity tests go through getLayout.
- package.json "generate:layout" script points at scripts/generate-layout.ts.

Out of scope
Codes, countries, code unions (A3); 2025 and public exports (A4).

Verify
Run generate:layout twice — the second run produces no git diff. Run the verify bundle.

Commit: "feat(opcn1214-generator): generate the record layout from CSV"

Done when
- All 17 records and 270 fields are in the generated module and pass the integrity tests.
```

#### A3 — Layout generator v2: codes, countries and code unions

```text
STEP A3 — Layout generator v2: codes, countries and code unions
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
A2 generates records and header fields; RecordDef.codes and YearLayout.countries are still empty.
codes.csv holds 260 codes (1000: 102, 2000: 51, capital gains: 107) and countries.csv 255 country
codes. The input model needs literal unions of codes (SPEC §5.3, §7.2).

Read first
- SPEC §3.5, §3.6, §4.5, §5.3, §7.4 (derived codes); codes.csv; countries.csv.

Goal
The generated layout contains every code and the country table; src/model/codes.generated.ts exports
the code unions with the spec notes as JSDoc.

Tests first
1. Extend tests/layout/integrity.test.ts: codes unique per record, 3 digits, length 1–12; total 260;
   2000 has exactly 23 perCountryBreakdown codes; zeroAllowed codes are exactly
   1000: 032 072 080 081 084 086 094 096 097 121 159, 2000: 442, 3054: 016; derived codes are
   exactly 1000: 008 028 273 277 278 280 297 and 3077: 501–505; countries: 255 unique entries,
   including '-88', all other codes zero-padded to 3 digits when looked up via a helper
   `countryKey(code)`; for every record with a code-amount section, the sum over ALL its codes of
   (3 + length) is <= the section length (D-10: a section can never overflow).
2. tests/model/code-unions.test.ts — type-level tests (expectTypeOf) that '010' is assignable to
   MainFormInputCode, '008' is not, '420' is assignable to CountryBreakdownCode, '401' is not, and
   CapitalGainsCode<77> includes '501'; runtime arrays (MAIN_FORM_CODES etc.) have the same members
   as the unions.
3. codegen-sync test covers both generated files.

Implementation
- Extend scripts/layout/render.ts and generate-layout.ts to read codes.csv and countries.csv:
  RecordDef.codes (sorted by code), CodeDef.derived from the fixed list above (put the list in
  scripts/layout/derived-codes.ts with a comment pointing to SPEC §7.4), YearLayout.countries as
  `ReadonlyMap<string, string>` keyed by 3-digit code ('-88' stays '-88').
- src/model/codes.generated.ts (year-independent unions generated from the newest layout):
  MainFormCode, DerivedMainCode, MainFormInputCode, ForeignAppendixCode, CountryBreakdownCode,
  CapitalGainsSymbol (27|50|51|54|60|63|64|65|66|77), CapitalGainsCode<S>, CountryCode, plus
  `as const` arrays of each. JSDoc on each code literal: the Hebrew notesHe when present.
- YearLayout.limits: { reportsPerFile: 50, capitalGainsAppendices: 14, mainCodePairs: 61,
  countriesPerRecord: 10 }.
- RecordDef.section.maxEntries: 1000 → 61; 2200 → 10; every other record → its number of codes.

Wiring
- getLayout(2024) now returns codes and countries; codes.generated.ts is imported by nothing in
  src/ yet except a re-export from src/model/index.ts that C1 consumes. (Exception allowed: type
  modules of the foundation layer.)

Out of scope
2025, public exports (A4).

Verify
Run generate:layout (no diff on second run) and the verify bundle.

Commit: "feat(opcn1214-generator): generate code tables, country table and code unions"

Done when
- Integrity and union tests pass; the generated files are prettier-clean and in sync.
```

#### A4 — Layout registry, integrity and first public exports

```text
STEP A4 — Layout registry, integrity and first public exports
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
getLayout is internal and only knows 2024. SPEC §14 requires 2025 to reuse the 2024 layout until a
2025 spec exists, and SPEC §6.1/§6.3 define the public getLayout/supportedTaxYears and the error
hierarchy.

Read first
- SPEC §6.1, §6.3, §6.4, §11.2, §14.

Goal
A public, typed layout registry for 2024 and 2025 and the error base classes; src/index.ts stops
being a placeholder.

Tests first
1. tests/layout/registry.test.ts — supportedTaxYears() deep-equals [2024, 2025]; getLayout(2025)
   deep-equals getLayout(2024) except taxYear; getLayout(2023) and getLayout(2026) throw
   Opcn1214UnsupportedYearError with taxYear set and an issue with ruleId
   'struct.taxYear.unsupported'; the returned layout objects are frozen (Object.isFrozen at the
   record level).
2. tests/errors.test.ts — every error class sets `name`, extends the right parent, keeps `issues`,
   and Opcn1214Error's message summarizes up to five issues (SPEC §11.2).
3. tests/api/exports.test.ts — the public module exports exactly: getLayout, supportedTaxYears,
   Opcn1214Error, Opcn1214UnsupportedYearError, Opcn1214InternalError (runtime keys of
   `import * as api from '../../src/index.js'`). Update this list in every later step that adds
   public exports.

Implementation
- src/errors.ts — Opcn1214Error (issues), Opcn1214UnsupportedYearError (taxYear),
  Opcn1214InternalError. The Issue type needed by the errors: create src/validate/issue.ts with the
  `Issue` and `Severity` types from SPEC §9.1 (types only; the rule-ID union is a plain string for
  now and is narrowed in C3).
- src/layout/2025/index.ts — `{ ...LAYOUT_2024, taxYear: 2025 }` (deep-frozen copy).
- src/layout/registry.ts — map year → layout, `supportedTaxYears()`, deep-freeze at module load.
- src/index.ts — export the functions, error classes and the public types (YearLayout, RecordDef,
  FieldDef, CodeDef, RecordType, FieldKind, Issue, Severity). Remove SPEC_STATUS and delete
  tests/smoke.test.ts.

Wiring
Public entry point now exposes the layout registry.

Out of scope
Validation, codecs.

Verify
Run the verify bundle; `build` must emit dist/typings/index.d.ts containing getLayout.

Commit: "feat(opcn1214-generator): public layout registry for 2024 and 2025"

Done when
- Registry, error and export tests pass; no placeholder code remains.
```

---

### Part B — Codecs: any record to and from text

#### B1 — Codec contract and numeric codecs

```text
STEP B1 — Codec contract and numeric codecs
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
IMPLEMENTATION_PLAN.md §1.2 fixes the Codec contract and the value conventions per kind. SPEC §4.1,
§4.2, §4.4 define encoding. This step covers the numeric family.

Read first
- IMPLEMENTATION_PLAN.md §1.2; SPEC §4.1, §4.2 (kinds table), §4.4, §15 A-1, A-21.

Goal
src/codec/ with the contract, padding helpers and codecs for: num, digits, id9, shareholderId, year,
count, serial, const, foreignCode, amount, amountX, amountX100, rateX100, filler.

Tests first (tests/codec/numeric.test.ts, table-driven)
1. padNumeric / padAlphanumeric — right-aligned; numeric pads '0' on the left; alphanumeric pads
   spaces on the side given by ALPHANUMERIC_PAD_SIDE ('left'); value longer than width throws
   Opcn1214InternalError.
2. For each kind: encode examples (e.g. amount 1234 width 12 → '000000001234'; id9 '12345' →
   '000012345'; amountX100 1234.56 → '000000123456'; amountX100 0.1 + 0.2 → '000000000030';
   rateX100 23 → '2300'; amountX 0 in an alphanumeric field of 12 → '           0'; filler numeric →
   zeros, alphanumeric → spaces; undefined → zeros (numeric) or spaces (alphanumeric)).
3. Encoders throw Opcn1214InternalError for: negative, non-integer amount, NaN, more than 2 decimals
   for ×100 kinds, value wider than the field, non-digit id9.
4. Round trip: decode(encode(v)) equals v for representative values of each kind; all-zero numeric
   text decodes to 0 (deciding "absent" is the record codec's job, B4); id9/shareholderId/digits
   decode to the full-width digit string ('12' encoded in 3 → '012' → '012'); decode of non-digits
   throws CodecDecodeError with reason 'numeric' and the offset of the first bad character.

Implementation
- src/codec/types.ts — Primitive, FieldShape, Codec, CodecDecodeError (reason + offset, exactly as
  in IMPLEMENTATION_PLAN.md §1.2; internal, not exported from index).
- src/codec/padding.ts — padNumeric, padAlphanumeric, ALPHANUMERIC_PAD_SIDE (SPEC §15 A-1).
- src/codec/numeric.ts — the codecs above. ×100 scaling uses Math.round(v * 100) after checking
  Math.abs(v * 100 - Math.round(v * 100)) <= 1e-6 (SPEC §4.4).
- src/codec/registry.ts — `CODECS: Partial<Record<FieldKind | CodeKind, Codec>>` and
  `codecFor(kind)` (throws Opcn1214InternalError for a missing kind).

Wiring
The registry is the single entry point B2–B4 use.

Out of scope
Text, date, boolean, enum, percent, phone codecs (B2); sections (B3).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): codec contract and numeric codecs"

Done when
- Every numeric kind has a codec with encode/decode tests and round trips.
```

#### B2 — Text normalization, windows-1255 and the remaining codecs

```text
STEP B2 — Text normalization, windows-1255 and the remaining codecs
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
B1 created the codec registry as a Partial record. This step completes it, so CODECS becomes a total
Record<FieldKind | CodeKind, Codec> (compile-time exhaustiveness).

Read first
- SPEC §4.2 (text, hebrewText, date, flag, yesNo, enum, phonePrefix, percentX100, percentLiteral),
  §4.3, §8.5, §15 A-2, A-3, A-19, A-20.

Goal
normalizeText, windows-1255 helpers and codecs for all remaining kinds.

Tests first
1. tests/normalize/text.test.ts — each §4.3 rule: NFC, bidi controls removed, NBSP/tab → space,
   typographic quotes and dashes replaced, trim and collapse; Hebrew stays in logical order;
   geresh/gershayim and niqqud kept; control characters are NOT removed (validation reports them);
   isAllowedTextChar(ch) is false for U+0000–U+001F, U+007F and anything not in windows-1255.
2. tests/codec/windows1255.test.ts — encodeWindows1255('שלום abc\r\n') round-trips through
   decodeWindows1255; byte length equals string length; isWindows1255Representable is true for
   Hebrew, ASCII and CR/LF and false for emoji and CJK (iconv would emit '?' for them);
   encodeWindows1255 throws Opcn1214InternalError if any character is not in the code page (never
   emits '?'). The "no control characters in text" check is NOT here (D-14): it is
   isAllowedTextChar in src/normalize/text.ts, used by field.charset in C3.
3. tests/codec/text.test.ts — text/hebrewText alnum padding and round trip; value wider than field
   throws; date '2024-12-31' ↔ '31/12/2024', all spaces ↔ undefined, invalid raw date →
   CodecDecodeError('date'); flag true → '1', undefined → '0', '1' → true, '0' → undefined; yesNo
   true → '1', false → '2', undefined → '0'; enum 12 width 3 → '012' (value must be in shape.values,
   else InternalError); phonePrefix '02' in alphanumeric width 3 → ' 02' and in numeric width 3 →
   '002' (A-19), and both decode back to '02' (strip padding, keep the prefix's own leading zero:
   decode by stripping padding and leading zeros, then picking the allowed prefix with the same
   significant digits: '002' → '02', ' 02' → '02', '052' → '052'); percentX100 10.23 → ' 1023' (alnum, width 5); percentLiteral 100 → '00100',
   10.23 → '10.23', 5.5 → '05.50', and decode back to numbers.
4. tests/codec/registry.test.ts — every FieldKind and CodeKind resolves through codecFor.

Implementation
- src/normalize/text.ts — normalizeText(value: string): string; isAllowedTextChar(ch: string).
- src/codec/windows1255.ts — iconv-lite wrappers (encode, decode, isWindows1255Representable).
- src/codec/text.ts, src/codec/date.ts, src/codec/boolean.ts, src/codec/enum.ts,
  src/codec/percent.ts, src/codec/phone.ts.
- src/codec/registry.ts — make CODECS a total Record (remove Partial).

Wiring
All codecs registered; normalizeText is consumed by the normalizer in C1.

Out of scope
Sections, records.

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): text normalization, windows-1255 and remaining codecs"

Done when
- CODECS is total and type-checked; all codec tests pass.
```

#### B3 — Code-amount and country-amount section codecs

```text
STEP B3 — Code-amount and country-amount section codecs
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
Records 1000, 2000 and all 30xx end with a code-amount section; 2200 ends with a country-amount
section (SPEC §3.5, §3.6). Values of each code are encoded with the codec of the code's kind.

Read first
- SPEC §3.5, §3.6, §4.5, §15 A-10, A-22.

Goal
encode/decode for both section kinds, driven by CodeDef lists from the layout.

Tests first (tests/codec/sections.test.ts)
1. encodeCodeSection(new Map([['015', 3], ['010', 5000]]), codes1000, 2048) writes '010' + 12-digit
   5000 then '015' + '03' (ascending order regardless of Map order), then zeros to 2048.
2. Capital-gains codes are written with 3 digits ('015' for code 15); amountX100 and rateX100 codes
   are scaled; enum codes validated against values (InternalError otherwise).
3. Section overflow (sum of entries > length) throws Opcn1214InternalError.
4. decodeCodeSection is the exact inverse; stops at the first position where the remainder is all
   zeros; throws CodecDecodeError('section') with the offset for: unknown code, truncated entry,
   duplicate code, non-zero data after an all-zero gap.
5. Edge: an entry for a zeroAllowed code with value 0 as the LAST entry survives the round trip.
   (The stop rule "remainder is all zeros" is exact because no code is '000': every entry starts
   with a non-zero digit somewhere in its 3-digit code. Assert this invariant over all layout
   codes in the test.)
6. Country section: entries (affiliation 1, country 3, income 12) × up to 10, zero-filled to 1024;
   '-88' encoded literally; country '40' written '040'; round trip; malformed entry →
   CodecDecodeError('section').

Implementation
- src/codec/sections.ts — encodeCodeSection, decodeCodeSection, encodeCountrySection,
  decodeCountrySection.

Wiring
Used by the record codec in B4.

Out of scope
Validation of which codes are allowed (rules, later); zero omission (normalizer, C1).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): code-amount and country-amount section codecs"

Done when
- Both section codecs round-trip and reject malformed input with offsets.
```

#### B4 — Record codec and the all-records round trip

```text
STEP B4 — Record codec and the all-records round trip
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
With field and section codecs in place, a generic record codec can encode any record of any layout.
The NormalizedRecord type (IMPLEMENTATION_PLAN.md §1.2) is introduced here.

Read first
- IMPLEMENTATION_PLAN.md §1.2; SPEC §3.2 (prefix), §3.4.

Goal
encodeRecord/decodeRecord for every record type, proven on all 17 record types of 2024 with
generated sample values.

Tests first
1. tests/helpers/sample-values.ts (test helper) — sampleRecord(def): NormalizedRecord with a valid,
   width-fitting, NON-ZERO value for every non-filler field (by kind) and, for code-amount records,
   up to three codes covering every code kind the record has (several records have only `amount`
   codes); for 2200 two countries.
2. tests/codec/record.test.ts — for every RecordDef of getLayout(2024):
   - encodeRecord(def, sampleRecord(def)) has length def.length, starts with '1214' + type +
     '0' × 128;
   - every field slice at its position equals codecFor(kind).encode(value) for that field;
   - decodeRecord(def, line, 0) deep-equals the sample (values, codes, countries).
3. encodeRecord throws Opcn1214InternalError when the produced length differs (simulate with a
   corrupted RecordDef in the test).
4. decodeRecord throws CodecDecodeError (reason 'length' or 'format', offset = column - 1) for a
   wrong length or a prefix mismatch.
5. Absent values: for header fields with required !== 'yes', decodeRecord maps a decoded 0 to
   undefined (exception: amountX, where 0 is meaningful) and an all-zero digit string (id9,
   shareholderId, digits) to undefined; required fields keep 0 (e.g. 9999 counts). Test with a
   sample record whose optional numeric fields are undefined: encode → decode gives undefined.

Implementation
- src/model/normalized.ts — NormalizedRecord, NormalizedReport (as in §1.2; NormalizedReport.notices
  uses the Issue type from src/validate/issue.ts).
- src/codec/record.ts — encodeRecord, decodeRecord (fillers: write zeros/spaces, ignore on decode
  (SPEC §8.2 step 4); derived fields are encoded/decoded like any other field; the absent-value
  mapping of test 5).

Wiring
The record codec is the only way later code turns records into lines and back.

Out of scope
Normalization, file assembly.

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): generic record codec for every record type"

Done when
- The all-records round trip passes for all 17 record types.
```

---

### Part C — Walking skeleton: a minimal real report, end to end

#### C1 — Skeleton input model and normalizer (1000 core + 1020)

```text
STEP C1 — Skeleton input model and normalizer (1000 core + 1020)
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
The smallest fileable report has: record 1000 with company identity, the seven required
declarations and main-form amounts; at least one 1020 shareholder; and 9999. This step introduces
the public input types for exactly that subset and the normalizer that turns them into a
NormalizedReport. Later steps extend the same interfaces (never a parallel type).

Read first
- SPEC §7.1, §7.2 (Report1214Input, CompanyDetails, Phone, Declarations — required members only,
  Shareholder), §7.3, §7.4 (rows for prefix, 150, 165, 832, 833, codes 008 and 273, 1020 serial),
  §4.3, §4.5; IMPLEMENTATION_PLAN.md §1.2 value conventions; fields.csv rows for 1000 and 1020.

Goal
normalizeReport(input, layout, options) → NormalizedReport for the skeleton subset.

Tests first
1. tests/fixtures/builders.ts — `minimalInput(overrides?)`: a valid skeleton report (taxYear 2024,
   company with file number, registered name, two addresses, phone; the seven required declarations
   all `false`; amounts for the required codes with values valid for their allowed sets: 018 = 4,
   072 = 0, 081 = 1000, 094 = 0, 263 = 1; one shareholder with a Hebrew name and dividend rights
   100). Deep-merge overrides. Keep it valid against EVERY rule of SPEC §10 (later steps rely on it).
2. tests/normalize/main.test.ts —
   - every 1000 key produced from the skeleton input has the expected value and path
     (e.g. paths['company.phone.number'] === 'company.phone.number');
   - meta defaults: softwareName 'ACCOUNTER'; saveDate from options.today; default today is
     todayInJerusalem(now = new Date()) — test it with fixed Date values around midnight UTC;
   - text fields pass through normalizeText;
   - derived: 832 false, 833 false (no appendices exist yet), code 273 for all four combinations of
     1029/1030, code 008 = 1 only when appliesAccountingStandards;
   - amounts: zero for a non-zeroAllowed code is omitted and listed in omittedZeroCodes; zero for a
     zeroAllowed code (072) is kept; codes' paths are `amounts["072"]`.
3. tests/normalize/shareholders.test.ts — one record per shareholder in input order, index and
   serialNumber (1-based), boolean/number mapping, paths `shareholders[i].<key>`.
4. A digit string that is not all digits (e.g. company.fileNumber '12a') is kept as-is in values
   (rules will reject it in C3). Phone numbers stay digit strings (kind `digits`).

Implementation
- src/model/input.ts — skeleton subset of SPEC §7.2. Mark with a TODO-free comment which SPEC
  section each interface implements; optional members not yet supported are simply absent.
- src/model/index.ts — re-exports.
- src/model/options.ts — ValidateOptions { rounding?: 'reject' | 'halfUp'; today?: () => IsoDate }
  and GenerateOptions = ValidateOptions (SPEC §6.2).
- src/normalize/today.ts — todayInJerusalem(now = new Date()): IsoDate (Intl.DateTimeFormat with
  timeZone 'Asia/Jerusalem').
- src/normalize/paths.ts — pathFor(recordType, inputIndex, key): the input path of a key (SPEC §7.3
  and §9.1 path grammar); every normalizer uses it, and the parser reuses it in C7b.
- src/normalize/main.ts, src/normalize/shareholders.ts, src/normalize/report.ts (orchestrates,
  orders records per SPEC §3.3, fills omittedZeroCodes and notices: []).
- src/normalize/derive.ts — code 273 and 008 derivations as small pure functions.

Wiring
normalizeReport uses getLayout, normalizeText and the layout's FieldDef keys; C2 consumes it.

Out of scope
Validation, encoding, optional declarations, preparer (D1+), other record types.

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): skeleton input model and normalizer"

Done when
- The minimal input normalizes into one 1000 and one 1020 record with every key, path and derived
  value asserted.
```

#### C2 — File assembly and the 9999 control record

```text
STEP C2 — File assembly and the 9999 control record
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
NormalizedReport (C1) + record codec (B4) are enough to produce the file text and bytes, once the
9999 record is derived and lines are joined.

Read first
- SPEC §3.1, §3.3, §3.8, §8.1 steps 6–7, §8.3.

Goal
renderReport(report) → { lines, text, bytes } with 9999 derived from the records.

Tests first (tests/file/assemble.test.ts)
1. buildControlRecord(report) counts: reportCount 1; 1010, 1020, 2000 (0/1), capital-gains, 2200
   and 1030 counts from report.records (construct NormalizedReports by hand for counts > 0).
2. renderReport(normalizeReport(minimalInput())) — exactly 3 lines; lengths 4232, 1160, 150; text
   ends with '\r\n' and lines are joined with '\r\n'; bytes.length === text.length; selected slices:
   1000@137 (file number), 1000@146 '2024', 1000@165 'DD/MM/YYYY' of the injected today, 1000@832
   '2', 1000 code section starts at 2185 with '018'; 1020@137 '01'; 9999@141 '01'.
3. Records are emitted in report.records order (assembly does not reorder; ordering is the
   normalizer's job) and 9999 is always last.
4. Determinism: two calls with the same input produce identical bytes.

Implementation
- src/file/control.ts — buildControlRecord(report): NormalizedRecord for 9999.
- src/file/assemble.ts — renderReport(report): encodes each record with encodeRecord, appends 9999,
  joins with CRLF plus a final CRLF, encodes with encodeWindows1255. Asserts line lengths.

Wiring
renderReport(normalizeReport(...)) is the internal generation path; C6 puts validation in front of
it.

Out of scope
Validation; public API.

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): file assembly and control record"

Done when
- The minimal input renders to a three-line windows-1255 file with all asserted slices.
```

#### C3 — Validation framework and first field rules

```text
STEP C3 — Validation framework and first field rules
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
Rules are data (RULES metadata, SPEC §9.1) plus implementations run by an engine over the
NormalizedReport (SPEC §9.2 stages 3–5). Generic field rules are driven by FieldDef/CodeDef
(SPEC §9.3). Every rule needs a pass and a fail case (SPEC §13.4).

Read first
- SPEC §9 (all), §10.2 (first four rules), §13.4; IMPLEMENTATION_PLAN.md §1.2 (runPipeline).

Goal
Issue sorting, the RULES catalogue with a narrowed RuleId union, the engine, the internal
runPipeline with its year stage, and the rules struct.taxYear.unsupported, field.required,
field.numeric, field.length, field.charset.

Tests first
1. tests/validate/issue.test.ts — compareIssues orders by reportIndex, record order (SPEC §3.3),
   recordIndex, field position or code, ruleId.
2. tests/rules/cases.ts — `export const RULE_CASES: { [K in RuleId]: RuleCase }` where
   RuleCase = { kind: 'input'; fail(): unknown; pass(): unknown; path?: string } (a 'file' kind is
   added in C7). Fail cases are built from minimalInput() with one deliberate defect.
3. tests/rules/rules.test.ts — for every RULES entry: runPipeline(fail()) contains exactly one issue
   with that ruleId (at `path` when given, with the catalogued severity); runPipeline(pass()) has
   no issue with that ruleId. Also: pass() of every case has zero errors overall.
4. tests/rules/spec-sync.test.ts — every RULES id appears in SPEC.md §10 (read the file via
   import.meta.url; take the FIRST cell of each table row in §10.1–§10.7 and strip the backticks).
   (Equality is enforced in H4.)
5. Field rules details: required header field missing; required code missing (018); a required
   code that is not zeroAllowed given 0 counts as missing; '12a' in company.fileNumber →
   field.numeric; registered name of 51 characters → field.length; emoji / CR in a text field →
   field.charset (via isAllowedTextChar); issue carries `field` {position, length, nameHe} or
   `code`, and `specRef.page`.
6. Slot-aware required (SPEC §9.3, D-12): on a synthetic 3077 NormalizedRecord, an empty
   improvements[1] slot raises nothing; improvements[1].expense set without improvements[1].date
   raises field.required at that date key.
7. struct.taxYear.unsupported: runPipeline({ ...minimalInput(), taxYear: 2023 }) returns exactly
   that issue (path 'taxYear') and does not throw; nothing else runs after it.

Implementation
- src/validate/issue.ts — finish Issue (ruleId: RuleId), compareIssues, makeIssue helper.
- src/validate/rules.ts — avoid a circular type: define RuleMetaInput (RuleMeta fields with
  `id: string`); `export const RULES = [...] as const satisfies readonly RuleMetaInput[]`;
  `export type RuleId = (typeof RULES)[number]['id']`;
  `export type RuleMeta = Omit<RuleMetaInput, 'id'> & { id: RuleId }`. Add the five rules
  (source/severity/scope/description/specRef from SPEC §10).
- src/validate/field-rules.ts — one generic pass over every record's header fields and codes.
- src/validate/engine.ts — runRules(report): Issue[] = report.notices + field stage + business
  stage + structure stage (the latter two are empty registries for now), sorted.
- src/pipeline.ts — runPipeline(input: unknown, options): stage 1 checks input.taxYear against
  supportedTaxYears() (struct.taxYear.unsupported, stop); then getLayout → normalizeReport →
  runRules. Until C5 the rest of the input is assumed well-typed (cast after the year check).
- A4's registry already builds an issue with ruleId 'struct.taxYear.unsupported'; it now type-checks
  against the narrowed RuleId.

Wiring
runPipeline is the single validation entry point (C6's validate1214 and generate1214 call it).

Out of scope
Other field rules (C4); zod (C5).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): validation engine and first field rules"

Done when
- The five rules pass the case harness; adding a RULES entry without a case fails typecheck.
```

#### C4 — Remaining generic field rules

```text
STEP C4 — Remaining generic field rules
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
C3 built the engine and four field rules. SPEC §10.2 lists the rest. Two rules interact with the
normalizer: an invalid phone prefix is dropped with a warning (it then triggers field.required for
the required 1000@493), and the `rounding` option changes amount handling (SPEC §4.4).

Read first
- SPEC §4.4, §10.2; IMPLEMENTATION_PLAN.md §1.3 D-5.

Goal
field.integer, field.decimals, field.negative, field.enum, field.date, field.percentRange,
field.hebrewFirstLetter, field.phonePrefix (W), field.phoneNumber — each with
RULES entry, implementation and cases.

Tests first
1. Add a RULE_CASES entry for each rule (typecheck forces it), using a defect the skeleton input
   can express: 1.5 in an amount code (field.integer); -1 in an amount (field.negative); code 014 = 3
   (field.enum — applies to kinds `enum` and `rateX100` only, SPEC §10.2); meta.saveDate
   '2024-02-30' (field.date); shareholders[0].dividendRightsPercent
   100.01 (field.percentRange) and 10.123 (field.decimals); shareholder fullName '1abc'
   (field.hebrewFirstLetter); phone prefix '01' (field.phonePrefix — build it with a cast; the
   C5 schema accepts any string there so the rule stays reachable); phone number '123'
   (field.phoneNumber, checked on the digit string: exactly 7 digits). Kinds the skeleton cannot express yet (amountX100, percentX100) get
   unit tests on synthetic NormalizedReports in tests/validate/field-rules.test.ts.
2. Rounding option: { rounding: 'halfUp' } turns 1.5 into 2 with no issue; default rejects.
3. Phone prefix: invalid prefix for company.phone produces field.phonePrefix (warning, path
   company.phone.prefix) AND field.required for 1000@493; for company.fax only the warning.

Implementation
- Extend src/validate/field-rules.ts by kind; the hebrewFirstLetter check uses U+05D0–U+05EA.
- src/normalize/main.ts — drop invalid prefixes and push the warning into report.notices; apply
  rounding when options.rounding === 'halfUp' (half away from zero).
- RULES entries.

Wiring
All via runPipeline/runRules.

Out of scope
zod (C5); business rules.

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): remaining generic field rules"

Done when
- Every rule of SPEC §10.2 is implemented and covered by RULE_CASES.
```

#### C5 — Shape stage (zod)

```text
STEP C5 — Shape stage (zod)
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
Public callers may pass anything (validate1214 takes `unknown`). Stages 1–2 of SPEC §9.2 check the
tax year and the JavaScript shape with strict zod schemas before normalization; failures stop the
pipeline.

Read first
- SPEC §7.1 (strict objects, null rejected), §9.1 path grammar, §9.2 (incl. the zod notes), §10.1
  input.shape.

Goal
runPipeline(input: unknown) validates the shape after the year stage, then continues as before.

Tests first
1. tests/model/schema.test.ts —
   - minimalInput() passes;
   - unknown property at any depth → input.shape at that path (e.g. company.faxx). zod 4 reports
     these as one `unrecognized_keys` issue at the parent with a `keys` array: emit one issue per
     key with the key appended to the path;
   - null for an optional property → input.shape;
   - wrong type ('2024' for taxYear) → input.shape at 'taxYear';
   - amounts with key '999' → input.shape at amounts["999"] (D3 refines this to input.unknownCode);
   - amounts { '010': undefined } is accepted (optional values), and so is an object with
     undefined optional members;
   - company.phone.prefix '01' passes the shape stage (any string; field.phonePrefix reports it);
   - path conversion: zod path ['shareholders', 2, 'fullName'] → 'shareholders[2].fullName' and
     ['amounts', '018'] → 'amounts["018"]'.
2. A compile-time test: Report1214Input is assignable to `z.input<typeof report1214InputSchema>`
   (one direction only — the schema is deliberately looser for phone prefixes and country codes).
3. RULE_CASES for input.shape.

Implementation
- src/model/schema.ts — zod 4 strict schemas mirroring src/model/input.ts (z.strictObject;
  z.partialRecord(z.enum(MAIN_FORM_INPUT_CODES), z.number().optional()) for amounts; IsoDate as a
  regex-checked string; digit strings, phone prefixes and (later) country codes as plain
  z.string() — semantic checks stay in rules). Export schemaFor(taxYear) even though both years
  share one schema today.
- src/validate/shape.ts — zodIssuesToIssues(error): Issue[] with the path grammar.
- src/pipeline.ts — stage 2 (shape) after the year stage and before normalization; stop on its
  issues.

Wiring
runPipeline is now safe for untrusted input.

Out of scope
Public API (C6).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): strict input shape validation"

Done when
- Arbitrary input never makes runPipeline throw; shape problems are reported with exact paths.
```

#### C6 — Public API v1: validate1214 and generate1214

```text
STEP C6 — Public API v1: validate1214 and generate1214
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
runPipeline (validation) and renderReport (generation) exist. This step exposes them as the public
API of SPEC §6 and starts the golden-file suite.

Read first
- SPEC §6.1, §6.2, §6.4, §6.5, §11, §13.5, §13.8.

Goal
validate1214, generate1214, RULES and Opcn1214ValidationError are public; the `minimal` golden file
exists and is pending human verification.

Tests first
1. tests/api/validate.test.ts — valid input → { valid: true, errors: [], warnings: [] }; invalid →
   valid false with sorted errors; never throws for any JSON value (null, [], 'x', 42, {}).
2. tests/api/generate.test.ts — returns text, bytes, fileName '1214_<fileNumber>_2024.txt',
   warnings, summary { reports: 1, records: {'1000':1,'1020':1,'9999':1}, mainCodePairs,
   omittedZeroCodes }; throws Opcn1214ValidationError carrying all errors and warnings for invalid
   input; options.today is honoured.
3. tests/golden/golden.test.ts — for each tests/fixtures/golden/<name>.input.ts (exports a typed
   input and options with a fixed today), generate1214 bytes equal the committed <name>.opcn bytes.
   With UPDATE_GOLDEN=1 the test writes the files instead (document this in tests/fixtures/golden/
   README.md: only for steps that intentionally add or change golden files). The test also asserts
   that each golden's sha256 equals the value in VERIFICATION.md, so changing a golden always
   requires editing that table (and resetting a VERIFIED row to PENDING).
4. exports.test.ts updated with the new public names.

Implementation
- src/errors.ts — Opcn1214ValidationError.
- src/api/validate.ts, src/api/generate.ts (calls runPipeline; throws on errors; then
  renderReport; builds summary and fileName).
- src/index.ts — export validate1214, generate1214, RULES, Report1214Input and its sub-types,
  IsoDate, PhonePrefix, the code unions of src/model/codes.generated.ts (MainFormCode,
  MainFormInputCode, ForeignAppendixCode, CountryBreakdownCode, CapitalGainsSymbol,
  CapitalGainsCode, CountryCode), ValidateOptions, GenerateOptions, ValidationResult,
  GenerateResult, RuleMeta, RuleId.
- packages/opcn1214-generator/.gitattributes — `*.opcn binary`.
- tests/fixtures/golden/minimal.input.ts + minimal.opcn (generated with UPDATE_GOLDEN=1) and
  VERIFICATION.md (table: fixture | sha256 | generated on | shopcn result | notes) with `minimal`
  marked PENDING.

Wiring
Public API complete for the skeleton subset.

Out of scope
Parsing (C7).

Verify
Run the verify bundle. Inspect minimal.opcn with `xxd | head` and confirm CRLF line ends and the
record lengths.

Commit: "feat(opcn1214-generator): public validate and generate API"

Done when
- A consumer can validate and generate a minimal 1214 file through the package's public API.
- VERIFICATION.md lists `minimal` as PENDING for checkpoint CP-1.
```

> **Human checkpoint CP-1 (after C6).** Upload `tests/fixtures/golden/minimal.opcn` unchanged to
> <https://secapp.taxes.gov.il/shopcn>. Record the result in `VERIFICATION.md`. If it is rejected,
> stop the plan and run a fix-up step (template at the end of Part 3) before C7a: the most likely
> causes are SPEC §15 A-1 (alphanumeric padding side), A-5 (line endings) and A-6 (encoding).

#### C7a — Parser v1: happy path and round trip

```text
STEP C7a — Parser v1: happy path and round trip
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
The record codec already decodes any record. This step turns a well-formed file back into the
public input: byte decoding, line splitting, decoding into a NormalizedReport, denormalizing and
canonicalizing. Structural error reporting is C7b. From now on, every step that adds input must
also extend denormalize/canonicalize and keep the round-trip tests green.

Read first
- SPEC §6.1 (parse1214), §6.2 (ParseOptions, ParseResult), §8.2 steps 1, 2, 4, 5, 7, §8.4.

Goal
Public parse1214 for the skeleton subset and both round-trip properties.

Tests first
1. tests/file/split.test.ts — windows-1255 bytes and strings; UTF-8 BOM stripped; CRLF and LF
   accepted; one trailing empty line ignored.
2. tests/normalize/canonical.test.ts — canonicalize(input, options) per SPEC §8.4: text normalized,
   empty optionals removed, digit strings padded to width (company.fileNumber '12345' →
   '000012345'), zero codes removed unless zeroAllowed, meta.saveDate from options.today.
3. tests/roundtrip/roundtrip.test.ts — (a) parse1214(generate1214(x).bytes).report deep-equals
   canonicalize(x) for minimalInput variants (with/without optional members, zero codes, digit
   strings needing padding); (b) for every golden file, generate1214 of the parsed report (with the
   parsed saveDate/softwareName in meta) gives the golden bytes.
4. ParseResult.issues contains field/business issues of a structurally valid but invalid file
   (e.g. the registered name at 1000@175 replaced by 50 spaces → field.required at
   company.registeredName) and parse1214 does not throw for them.

Implementation
- src/file/split.ts — decode bytes (options.encoding) + split lines.
- src/file/parse.ts — decode every line with decodeRecord (record type from positions 5–8), select
  the layout from the 1000 record's tax year, build the NormalizedReport (paths via pathFor, using
  the emission index as the input index).
- src/normalize/denormalize.ts — NormalizedReport → Report1214Input for the skeleton subset.
- src/normalize/canonical.ts — canonicalize(input, options).
- src/api/parse.ts — parse1214: split → parse → denormalize; ParseResult.issues = runRules on the
  decoded report. For now a structural problem may surface as a thrown CodecDecodeError — C7b
  turns those into Opcn1214ParseError.
- src/index.ts — export parse1214, ParseOptions, ParseResult.

Wiring
generate1214 and parse1214 share the codecs, model and paths.

Out of scope
Structural error collection and parse.* rules (C7b).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): parser and round-trip guarantees"

Done when
- Both round-trip properties hold for the minimal fixtures and the `minimal` golden.
```

#### C7b — Parser v1: structural errors

```text
STEP C7b — Parser v1: structural errors
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
C7a parses well-formed files. Malformed files must produce Opcn1214ParseError with every structural
problem (not just the first), each with line and column, and the rule harness must accept file
cases.

Read first
- SPEC §8.2 (all), §10.7, §13.4 (RuleCase kinds), §11.2.

Goal
Structural detection and the rules parse.empty, parse.encoding, parse.lineLength, parse.formType,
parse.recordType, parse.prefixFiller, parse.order, parse.control.missing, parse.control.counts,
parse.numeric, parse.date, parse.codeSection; the 'file' RuleCase kind.

Tests first
1. tests/fixtures/files.ts (helper) — tamper(text, { line, position, value }), dropLine(text, line),
   swapLines(text, a, b).
2. Extend RuleCase with { kind: 'file'; fail(): string | Uint8Array; pass(): string | Uint8Array }.
   The runner collects issues as
   `try { return parse1214(content).issues } catch (e) { if (e instanceof Opcn1214ParseError) return e.issues; throw e }`
   so the same kind serves structural rules (thrown) and business rules on parsed files (D4, G5).
3. RULE_CASES for every parse.* rule of this step, built with the helpers from the `minimal`
   golden; parse.encoding via options.encoding 'utf-8' and invalid UTF-8 bytes.
4. tests/api/parse.test.ts — a file with three independent defects on different lines reports all
   three, sorted by line; every issue has line and column; CodecDecodeError never escapes
   parse1214.
5. A tax year in 1000@146 outside supportedTaxYears() → struct.taxYear.unsupported (thrown).

Implementation
- src/errors.ts — Opcn1214ParseError.
- src/file/parse.ts — per-line checks (length, form type, record type, prefix zeros), order check
  against SPEC §3.3 for the record types known so far, control-record presence and counts; catch
  CodecDecodeError per line and convert it (reason → rule: numeric → parse.numeric, date →
  parse.date, section → parse.codeSection, length → parse.lineLength, format → parse.formType or
  parse.recordType by offset); continue with the next line.
- src/validate/rules.ts — RULES entries (scope 'parse').

Wiring
parse1214 throws Opcn1214ParseError for structural problems and returns business issues otherwise.

Out of scope
parse.occurrences, parse.multipleReports, parse.derivedMismatch, batches (H1).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): structural parse errors"

Done when
- Every listed parse.* rule passes its file case; malformed files never throw anything but
  Opcn1214ParseError.
```

---

### Part D — Record 1000 complete

Every step in Parts D–G follows the same **vertical-slice recipe**; each prompt names only what is
specific to it:

1. Extend the public types in `src/model/input.ts` (SPEC §7.2) and the zod schema
   (`src/model/schema.ts`); keep the type-equality test green.
2. Extend the normalizer (keys and paths per SPEC §7.3, derivations per SPEC §7.4).
3. Extend `denormalize` and `canonicalize`.
4. Extend `tests/fixtures/builders.ts`.
5. Add rules (RULES + implementation + RULE_CASES) if the step lists any.
6. Extend the round-trip suite with fixtures exercising every new member.

#### D1 — Declarations and preparer

```text
STEP D1 — Declarations and preparer
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
Record 1000 still lacks the optional declarations and the preparer block. They are pure field
mappings (flags, yes/no, enums, dates); their cross-field rules arrive in D4/D5.

Read first
- SPEC §7.2 PreparerDetails and Declarations (all optional members), §7.3 mapping table rows for
  836, 851, 863, 1034–1046 and 833, §7.4 (833); fields.csv 1000 rows 563–886 and 1029–1064.

Goal
Every optional declaration and the preparer encode, decode and round-trip.

Tests first
1. tests/normalize/main.test.ts — for each new member: key, encoded value, path. Specifically:
   form6111Obligation obliged/notObliged/notRelevant → 834 = 1/2/3; consolidatedReport three values
   → 875 = 1/2/3; familyCompany object → 836 = 1 and 837 = representativeFileNumber;
   beneficiaryEnterprise → 851 = 1, 852 = notice date; specialYear → 863 = 1, 864 = balance sheet
   date; reportablePositions [12, 7] → 1034 = '012', 1037 = '007', 1040–1046 = '000';
   requestsAdvancePayments/hasBuildingIncome/partOfMultinationalGroup are yes/no (1/2/0 when absent);
   hasCapitalGainsAppendix true forces 833 = yes; preparer phone with valid prefix.
2. Schema tests for the new members (strictness; reportablePositions is an array of integers with
   no length limit in the schema — D4 reports more than 5 as a normalizer notice; the normalizer
   writes the first five).
3. Round trip: an input with every new member set (builder `fullDeclarationsInput()`).

Implementation
Per the recipe. The enum literal ↔ code maps live next to the normalizer
(src/normalize/enums.ts) and are reused by denormalize.

Wiring
All new keys flow through normalizeReport → renderReport and parse → denormalize.

Out of scope
Rules about these fields (D4, D5); 297 and bank codes (D3).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): declarations and preparer in record 1000"

Done when
- Every 1000 header key between positions 563 and 1064 is produced by the normalizer (assert with a
  coverage helper that lists unmapped non-filler keys of record 1000 — only D2's groups remain).
```

#### D2 — Other income, attachments, capital-gains summary, qualifying company

```text
STEP D2 — Other income, attachments, capital-gains summary, qualifying company
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
Four small groups complete the header of record 1000.

Read first
- SPEC §7.2 (otherTaxableIncome, attachments, capitalGainsSummary, qualifyingCompany); fields.csv
  1000 rows 887–968 and 1065–1091; SPEC §4.2 percentX100 and amountX; §15 A-2, A-21.

Goal
All non-filler header fields of record 1000 are mapped.

Tests first
1. Normalizer: otherTaxableIncome.source → 887 (hebrewText), amount → 937, ratePercent 10.23 → 949
   ' 1023'; attachments counts → 954/957; capitalGainsSummary → 960/962/964–968;
   qualifyingCompany purchased/amortizationClaimed yes/no → 1065/1090, amounts → 1066/1078,
   amortizationAmount 0 → 1091 written as '0' (alphanumeric padding, A-21).
2. Coverage helper from D1: record 1000 has no unmapped non-filler header keys.
3. Round trip with every member set; canonicalize removes 0 for optional numeric header values
   (D-3) except 1091 which is explicitly allowed to be 0 (document the exception in SPEC §8.4).

Implementation
Per the recipe.

Wiring
As in D1.

Out of scope
Rules (D4, D5); code 028 (D3).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): remaining record 1000 header groups"

Done when
- Record 1000's header is fully mapped and round-trips.
```

#### D3 — Derived main codes and code-map guards

```text
STEP D3 — Derived main codes and code-map guards
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
Some main-form codes are derived from header data (SPEC §7.4) and must never come from the caller.
The amounts map needs dedicated rules instead of the generic input.shape.

Read first
- SPEC §3.5, §7.2 bankAccount, §7.4 (codes 028, 277, 278, 280, 297), §10.1 (input.derivedCode,
  input.unknownCode, struct.mainCodePairs.max), §10.3
  main.bankAccount.format.

Goal
Derived codes 028 (untransmitted part only; G1 adds transmitted appendices), 277/278/280, 297 and
the four rules.

Tests first
1. bankAccount { bank '12', branch '345', account '678' } → code 277 = 678, 278 = 12345 ('12' then
   '345'), 280 = 1; form6111Obligation obliged → 297 = 8, notObliged → 297 = 9, notRelevant/absent →
   no 297; capitalGainsSummary.untransmittedCount 3 → 028 = 3.
2. RULE_CASES: amounts["273"] given → input.derivedCode (message names `declarations.directorsReceivedOpinion`
   / `declarations.tookReportablePosition`); amounts["999"] → input.unknownCode (replaces the C5
   input.shape behaviour for code-map keys; update that test); 62 pairs after derivations →
   struct.mainCodePairs.max; bank '1' → main.bankAccount.format.
3. Denormalize: 277/278/280 → bankAccount; 297 → form6111Obligation only when 834 is absent
   (834 is the source of truth; 297 is checked for consistency in H1 parse.derivedMismatch).

Implementation
Per the recipe; input.derivedCode/input.unknownCode are produced by the shape stage BEFORE zod: scan
the amounts map keys against the year's CodeDefs, report them, and remove those keys from the value
handed to zod so they are not reported again as input.shape (SPEC §9.2).

Wiring
Derivations in normalizeReport; rules in the shape stage and the engine.

Out of scope
Business rules (D4, D5).

Verify
Run the verify bundle; the `minimal` golden must not change (if it does, stop and explain).

Commit: "feat(opcn1214-generator): derived main-form codes and code-map rules"

Done when
- Derived codes are produced and protected against caller input.
```

#### D4 — Record 1000 conditional requirements

```text
STEP D4 — Record 1000 conditional requirements
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
SPEC §10.3 lists conditional requirements of record 1000 that the generic field stage does not
evaluate (fields.csv `required = conditional`). They are business-stage rules over the
NormalizedReport, so they also run on parsed files.

Read first
- SPEC §10.3 (error rows), §15 A-13; IMPLEMENTATION_PLAN.md §1.3 D-5.

Goal
Rules: main.familyCompany.fileNumber, main.familyCompany.code080, main.houseCompany.code084,
main.investmentLaw.flag, main.beneficiaryEnterprise.noticeDate, main.specialYear.balanceSheetDate,
main.kibbutz.code226, main.buildingIncome.code259, main.cgReasons.otherText,
main.reportablePositions.required, main.reportablePositions.max.

Tests first
1. RULE_CASES for each. Rules that the input types make unreachable from input
   (beneficiaryEnterprise.noticeDate, specialYear.balanceSheetDate, familyCompany.fileNumber when the
   object exists) use 'file' cases built with tamper() on a generated file (C7b runner: business
   issues come from parse1214(...).issues).
2. Unit tests: code 080 = 0 satisfies main.familyCompany.code080 (zeroAllowed); the paths point at
   the controlling input property (e.g. amounts["080"] for the missing code,
   declarations.familyCompany for the flag).
3. main.reportablePositions.max has no field of its own (only five positions exist): the normalizer
   raises it as a notice (IMPLEMENTATION_PLAN.md §1.2) at declarations.reportablePositions[5] and
   writes the first five positions.

Implementation
- src/validate/main-rules.ts — one small function per rule, registered in the business stage.

Wiring
Business-stage registry in src/validate/engine.ts.

Out of scope
Warnings (D5).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): record 1000 conditional requirement rules"

Done when
- All listed rules pass their cases on both input and file paths where applicable.
```

#### D5 — Record 1000 warnings and shareholder rules

```text
STEP D5 — Record 1000 warnings and shareholder rules
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
The remaining record 1000 rules are consistency warnings (source: derived) plus the shareholder
rules and counts. Kibbutz reports may have no shareholders.

Read first
- SPEC §10.1 (struct.shareholders.min/max), §10.3 (warning rows except main.rd.*,
  main.capitalGains.flag, main.appendixTotal.min — those need later records), §10.4, §15 A-15;
  IMPLEMENTATION_PLAN.md §1.3 D-5.

Goal
Goldens `main-full` and `kibbutz`, and the rules main.kibbutz.code226Other,
main.reportablePositions.unexpected, main.cgUntransmitted.reason,
main.cgUntransmitted.reasonWithoutCount, main.bankAccount.withNoBank,
main.qualifyingCompany.purchaseAmounts, main.qualifyingCompany.amortizationAmount,
main.attachments.code070, main.attachments.code010, shareholders.dividendRights.total,
shareholders.duplicateId, struct.shareholders.min, struct.shareholders.max.

Tests first
1. RULE_CASES for each rule; dividend rights total computed in hundredths (33.33 + 33.33 + 33.34
   passes; 50 + 49.99 fails); total enforced only if at least one shareholder states it;
   duplicate IDs ignore 999999964/999999998.
2. Shape: shareholders becomes `Shareholder[]` that may be empty (the min rule, not the schema,
   rejects empty lists for non-kibbutz companies).
3. Golden `kibbutz`: isKibbutz, code 226, no shareholders; 9999 counts 00 shareholders.
4. Golden `main-full`: every record-1000 header field set, 61 code pairs, bank account, 99
   shareholders. It must be valid against EVERY rule of SPEC §10, including rules added in later
   steps: no code 165 (main.rd.records in E2), dividend rights totalling exactly 100, not a
   kibbutz, family/house-company codes present when flagged, no capital-gains or foreign flags
   without the records. Assert validate1214(main-full).warnings is empty too.

Implementation
- src/validate/main-rules.ts (warnings), src/validate/shareholder-rules.ts,
  src/validate/structure-rules.ts (struct.* counts).

Wiring
Business and structure stages.

Out of scope
Rules depending on 1030, 2000/2200 or capital gains.

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): record 1000 warnings and shareholder rules"

Done when
- Every SPEC §10.3/§10.4 rule except main.rd.*, main.capitalGains.flag and main.appendixTotal.min
  is implemented; `main-full` and `kibbutz` goldens are PENDING in VERIFICATION.md.
```

> **Human checkpoint CP-2 (after D5).** Verify `main-full` and `kibbutz` on shopcn; update
> `VERIFICATION.md`. Focus: percentage fields 949 and 1020@199–209 (SPEC §15 A-2, A-3), phone
> prefixes (A-19), bank code 278.

---

### Part E — Related companies and R&D investments

#### E1 — Related companies (1010)

```text
STEP E1 — Related companies (1010)
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
Record 1010 (0–3 per report) lists related companies in Israel and abroad. It has no section.

Read first
- SPEC §3.2, §3.3, §7.2 RelatedCompany, §7.4 (1010 serial), §10.1 struct.relatedCompanies.max;
  fields.csv rows for 1010.

Goal
relatedCompanies end to end (types, schema, normalizer, denormalizer, file order, 9999@139,
parser) and struct.relatedCompanies.max.

Tests first
1. Normalizer: relationType literals → 1..8 in the order of SPEC §7.2; serial numbers; paths
   relatedCompanies[i].<key>; records placed after 1000 and before 1020.
2. File: 9999@139 equals the count; parser accepts 1010 only between 1000 and 1020
   (parse.order otherwise).
3. RULE_CASES: four related companies → struct.relatedCompanies.max (the schema allows any array
   length; the rule reports the limit).
4. Round trip with 0, 1 and 3 related companies.

Implementation
Per the recipe; src/normalize/related-companies.ts.

Wiring
normalizeReport orchestrator; parser record-order table.

Out of scope
R&D (E2).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): related companies (record 1010)"

Done when
- Related companies generate, parse and round-trip; the limit rule passes its cases.
```

#### E2 — R&D investments (1030)

```text
STEP E2 — R&D investments (1030)
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
Record 1030 (0–5 per report) lists investments in R&D companies; main-form code 165 is their total.

Read first
- SPEC §3.2, §7.2 RdInvestment, §7.4 (1030 affiliation), §10.1 struct.rdInvestments.max, §10.3
  main.rd.records and main.rd.total; fields.csv rows for 1030.

Goal
rdInvestments end to end and three rules; golden `related-and-rd`.

Tests first
1. Normalizer: affiliation always 1; order after 1020; 9999@149 count.
2. RULE_CASES: six investments → struct.rdInvestments.max; code 165 > 0 with no investments →
   main.rd.records (E); total of investments ≠ code 165 → main.rd.total (W).
3. Round trip with 0 and 5 investments. Golden `related-and-rd` (3 related companies,
   5 investments, code 165 equal to the total).

Implementation
Per the recipe; src/normalize/rd-investments.ts; rules in src/validate/main-rules.ts.

Wiring
As in E1.

Out of scope
Foreign appendix.

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): R&D investments (record 1030)"

Done when
- `related-and-rd` is committed and PENDING in VERIFICATION.md; rules pass their cases.
```

---

### Part F — Foreign appendix

#### F1 — Foreign appendix (2000)

```text
STEP F1 — Foreign appendix (2000)
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
Record 2000 (0–1) is the foreign appendix: a header and a code-amount section of 51 codes. Its
presence drives 1000@832 and 9999@143. Country breakdowns (2200) come in F2; until then, a filled
per-country code is allowed without a breakdown (F2 adds the rule).

Read first
- SPEC §3.2, §3.5, §7.2 ForeignAppendix (without countryBreakdown), §7.4 (832), §10.5 first two
  rows, §15 A-4, A-9, A-14; fields.csv and codes.csv rows for 2000.

Goal
foreignAppendix end to end; 832 and 9999@143 derived; rules foreign.otherIncome.description and
foreign.refund.amount.

Tests first
1. Normalizer: header keys and paths (foreignAppendix.<key>); amounts → codes with paths
   foreignAppendix.amounts["420"]; zero for code 442 kept (zeroAllowed), zero for others omitted;
   832 = yes when present; 9999@143 = '01'.
2. Section starts at 1161 and amounts use 12 digits (A-4); the 2000 record is placed after 1030.
3. RULE_CASES for the two rules; input.unknownCode and input.derivedCode also apply to
   foreignAppendix.amounts (extend the shape-stage scan).
4. Round trip with and without the appendix.

Implementation
Per the recipe; src/normalize/foreign.ts; src/validate/foreign-rules.ts.

Wiring
normalizeReport, parser order table, control record.

Out of scope
countryBreakdown and 2200 (F2).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): foreign appendix (record 2000)"

Done when
- The foreign appendix generates, parses and round-trips; 832 and 9999@143 follow its presence.
```

#### F2 — Country breakdown (2200)

```text
STEP F2 — Country breakdown (2200)
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
Each filled per-country code of the foreign appendix (23 codes) needs exactly one 2200 record with
up to 10 countries. The country-amount section codec exists (B3); the country table is in the layout
(A3).

Read first
- SPEC §3.6, §7.2 ForeignAppendix.countryBreakdown, §7.4 (2200 rows), §10.5 breakdown rows, §10.7 parse.countrySection, §15 A-16;
  countries.csv.

Goal
countryBreakdown end to end; rules foreign.breakdown.required, foreign.breakdown.orphan,
foreign.breakdown.countries.min, foreign.breakdown.countries.max,
foreign.breakdown.country.unknown, foreign.breakdown.country.unknownOnlyFor439,
foreign.breakdown.country.duplicate, parse.countrySection; golden `foreign`.

Tests first
1. Normalizer: one 2200 record per breakdown, sorted by code; header 137 = code, 140 = deductions;
   countries with affiliation 1; paths foreignAppendix.countryBreakdown["420"].countries[i].country;
   9999@147 count; records placed right after 2000.
2. RULE_CASES for every listed rule ('-88' on 420 → unknownOnlyFor439; '-88' on 439 passes;
   11 countries → countries.max; '001' → country.unknown (note: '999' is a real code, the UN);
   the same country twice → duplicate). The schema accepts any string for country (SPEC §9.2).
3. parse.countrySection for a malformed entry (affiliation 2) via tamper().
4. Round trip; golden `foreign` (every per-country code, '-88' on 439, 10 countries on one code).

Implementation
Per the recipe; extend src/normalize/foreign.ts and src/validate/foreign-rules.ts; the parser
groups 2200 records under the 2000 appendix during denormalization.

Wiring
normalizeReport, parser, control record.

Out of scope
Capital gains.

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): foreign income by country (record 2200)"

Done when
- `foreign` golden committed and PENDING; all breakdown rules pass their cases.
```

> **Human checkpoint CP-3 (after F2).** Verify `related-and-rd` and `foreign` on shopcn (A-4, A-9,
> A-14, A-16 in SPEC §15).

---

### Part G — Capital-gains appendices

The ten appendix types share four shapes. G1 builds the shared machinery with the simplest type;
G2–G5 add families. Every type gets its own golden file.

#### G1 — Capital-gains framework and 3063

```text
STEP G1 — Capital-gains framework and 3063
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
capitalGains is a discriminated union on `symbol` (record type = 3000 + symbol). Appendix numbers
count per symbol; the "מספר בתל"ם" sequence counts across all appendices; records are grouped by
type ascending, input order within a type (SPEC §3.3, §7.4, §15 A-7). 1000@833, code 028 and
9999@145 depend on the appendices. 3063 (securities under section 6) is the simplest type: header
with foreign-asset flag and losses carried forward, 5 codes.

Read first
- SPEC §3.7, §7.2 CapitalGainsAppendix and Section6SecuritiesAppendix, §7.4 (833, 028, 30xx rows),
  §10.1 struct.capitalGains.max, §10.3 main.capitalGains.flag and main.appendixTotal.min,
  §15 A-7, A-12; fields.csv/codes.csv rows for 3063.

Goal
The capital-gains framework, record 3063 end to end, three rules, golden `cg-63`.

Tests first
1. Framework (tests/normalize/capital-gains.test.ts) using 3063 only: two 3063 appendices → appendix
   numbers 1, 2; records emitted after 2000/2200; paths capitalGains[i].<key> keep the INPUT index
   even when emission order differs; 833 = yes when any appendix exists; code 028 =
   appendices + untransmittedCount; 9999@145 count.
2. RULE_CASES: 15 appendices → struct.capitalGains.max; declarations.hasCapitalGainsAppendix false
   with appendices → main.capitalGains.flag; capitalGainsSummary.totalAppendicesCount lower than
   transmitted appendices (2000 + 30xx) + untransmittedCount → main.appendixTotal.min.
   main.capitalGains.flag is raised by the normalizer as a notice (833 itself is derived as yes, so
   the explicit `false` exists only in the input; IMPLEMENTATION_PLAN.md §1.2).
3. Codes: amounts use 3-digit keys ('022', '056'); input.unknownCode/derivedCode apply.
4. Round trip; golden `cg-63`.

Implementation
- src/model/input.ts — CapitalGainsAppendix = Section6SecuritiesAppendix (the union grows in later
  steps); schema as a z.discriminatedUnion on symbol.
- src/normalize/capital-gains/index.ts (ordering, numbering, sequence) and
  src/normalize/capital-gains/section6.ts; denormalize counterpart; parser order table for 3063.
- Code 028 and 833 derivations updated in src/normalize/derive.ts.

Wiring
normalizeReport, parser, control record, main-rules.

Out of scope
Other appendix types.

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): capital-gains framework and section 6 securities (3063)"

Done when
- 3063 generates, parses and round-trips; numbering, 833, 028 and 9999@145 are correct.
```

#### G2 — Securities with withholders: 3060 and 3064

```text
STEP G2 — Securities with withholders: 3060 and 3064
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
3060 (securities) and 3064 (REIT) share a header: four yes/no flags, up to four withholding agents
(name, branch, account), losses carried forward; 21 and 6 codes.

Read first
- SPEC §7.2 SecuritiesAppendix and ReitAppendix, §7.3 withholders rows, §15 A-8; fields.csv/
  codes.csv rows for 3060 and 3064.

Goal
Both types end to end with a shared normalizer helper; goldens `cg-60`, `cg-64`.

Tests first
1. withholders[0..3] → keys withholders[i].name/branch/account; withholder name must start with a
   Hebrew letter (field.hebrewFirstLetter fires at capitalGains[i].withholders[j].name); branch '12'
   canonicalizes to '012' (D-3); five withholders → input.shape.
2. gainFromInvestmentFund follows the PDF (A-8): 3060 accepts only false (2) or absent, 3064 only
   true (1) or absent; the other value is an error (rule cg.investmentFund.value, also applied to
   3065 in G3).
3. Mixed appendices (63, 60, 64) are grouped by type ascending; appendix numbers per symbol; the
   sequence is not written for these types (they have no "מספר בתל"ם" field).
4. Round trip; goldens.

Implementation
Per the recipe; src/normalize/capital-gains/securities.ts (shared by 3060/3064 and reused by 3065
in G3).

Wiring
Union, schema, normalizer, denormalizer, parser order table.

Out of scope
3065/3066.

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): securities and REIT appendices (3060, 3064)"

Done when
- Both types round-trip and their goldens are PENDING in VERIFICATION.md.
```

#### G3 — No-withholding appendices: 3065 and 3066

```text
STEP G3 — No-withholding appendices: 3065 and 3066
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
3065 (form 1322) extends the securities header with a withholding status and the sequence number;
3066 (form 1326) is a short variant. Their header positions differ from 3060 by one (147 vs 146
for the first withholder) — rely on the layout keys, never on offsets.

Read first
- SPEC §7.2 NoWithholding1322Appendix and NoWithholding1326Appendix, §15 A-18; fields.csv/codes.csv
  rows for 3065 and 3066.

Goal
Both types end to end; goldens `cg-65`, `cg-66`.

Tests first
1. withholdingStatus notWithheldFirstHalf → 2, notWithheldSecondHalf → 3, absent → 0.
2. The "מספר בתל"ם" sequence (3065@325, 3066@154) counts across all appendices in emission order:
   with appendices [63, 65, 60, 66] the 65 gets the sequence of its emission position.
3. Round trip; goldens.

Implementation
Per the recipe; reuse the G2 securities helper for 3065.

Wiring
As in G2.

Out of scope
Asset types (G4), 3077 (G5).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): no-withholding appendices (3065, 3066)"

Done when
- Both types round-trip; sequence numbering is asserted across mixed types.
```

#### G4 — Asset appendices: 3027, 3050, 3054, 3051

```text
STEP G4 — Asset appendices: 3027, 3050, 3054, 3051
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
Four types describe a sold asset with dates. 3027 (shares) has three optional dates and ×100
codes; 3050 (betterment tax) and 3054 (oil partnership) require a purchase date and the code-15
date; 3051 (forced virtual-currency transaction) requires the code-15 date, codes 071 (= 1) and 016,
and may carry two wallet addresses. Code 018 is a rate (23 or 50) stored ×100.

Read first
- SPEC §3.7 (p.38 guidance on symbol 51), §4.2 amountX100/rateX100, §7.2 SharesAppendix,
  BettermentTaxAppendix, OilPartnershipAppendix, ForcedVirtualCurrencyAppendix; IMPLEMENTATION_PLAN
  §1.3 D-6; fields.csv/codes.csv rows for 3027, 3050, 3051, 3054; extraction note for 3051.

Goal
Four types end to end; goldens `cg-27`, `cg-50`, `cg-54`, `cg-51`.

Tests first
1. 3027: codes 020/053/027 accept agorot and are written ×100 (1234.56 → 123456); code 018 23 →
   '2300', 30 → field.enum; dates → DD/MM/YYYY at 225/235/245; assetLocation abroad/israel → 1/2.
2. 3050/3054: missing purchaseDate or dates.code15 → field.required at the right paths; 3050
   code 014 ∈ {10, 20}.
3. 3051: codes 071 and 016 required (field.required); walletAddresses (≤ 150 chars each, two at
   most) at 236/386; buyerName must start with a Hebrew letter; sequence number at 234.
4. Round trip for each; goldens.

Implementation
Per the recipe; src/normalize/capital-gains/assets.ts.

Wiring
As in G2.

Out of scope
3077 (G5).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): asset capital-gains appendices (3027, 3050, 3054, 3051)"

Done when
- All four types round-trip; their goldens are PENDING in VERIFICATION.md.
```

#### G5 — Other transactions: 3077

```text
STEP G5 — Other transactions: 3077
Apply the standing instructions and the Part D vertical-slice recipe (IMPLEMENTATION_PLAN.md).

Context
3077 is the richest appendix: up to five improvements (expense, accumulated depreciation, date —
×100 amounts in the header) whose code-50 amounts are written as derived codes 501–505, an
improvement count at 245, a replacement asset, wallet addresses, and code 071 for virtual currency.

Read first
- SPEC §7.2 OtherTransactionsAppendix, §7.3 improvements rows, §7.4 (245, 501–505), §10.6, §15 A-11;
  fields.csv/codes.csv rows for 3077.

Goal
3077 end to end; rules cg.improvements.max, cg.improvements.code50Amount, cg.virtualCurrency.wallet
(improvement dates are covered by the slot-aware field.required, SPEC §9.3); goldens `cg-77` and
`capital-gains-max` (14 appendices of mixed types).

Tests first
1. improvements[i] → keys improvements[i].expense/accumulatedDepreciation/date (×100 amounts) and
   code 50(i+1) from code50Amount; 245 = improvements.length; passing 501 in amounts →
   input.derivedCode.
2. RULE_CASES for the three rules (six improvements → cg.improvements.max, raised as a normalizer
   notice since only five slots exist; the wallet rule also via a 'file' case). Plus: a 3077 with
   one improvement raises no field.required for the empty slots 2–5, and a parsed file with
   improvement 2's expense but no date raises field.required at capitalGains[i].improvements[1].date.
3. Code 092 accepts a single digit (A-11); dates.code15 and dates.code20 required.
4. capital-gains-max: 14 appendices across all ten types; asserts grouping, appendix numbers,
   sequence numbers, 9999@145 = 14, code 028.
5. Round trip; goldens.

Implementation
Per the recipe; src/normalize/capital-gains/other.ts; src/validate/capital-gains-rules.ts.

Wiring
Completes the CapitalGainsAppendix union; parser order table complete for all record types.

Out of scope
Batches, response file.

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): other-transactions appendix (3077)"

Done when
- All ten appendix types are supported; every SPEC §10.6 rule is implemented.
```

> **Human checkpoint CP-4 (after G5).** Verify every `cg-*` golden and `capital-gains-max` on shopcn
> (A-7, A-8, A-11 in SPEC §15).

---

### Part H — Completion

#### H1 — Parser hardening and batches

```text
STEP H1 — Parser hardening and batches
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
All record types parse. Remaining: occurrence limits in files, multiple reports per file
(OPCN batches of up to 50), and consistency of derived values in parsed files.

Read first
- SPEC §3.1, §6.1 (batch functions), §8.1 (batch), §8.2 step 3, §10.1 struct.batch.size, §10.7
  (parse.occurrences, parse.multipleReports, parse.derivedMismatch).

Goal
generate1214Batch, parse1214Batch, and rules parse.occurrences, parse.multipleReports,
parse.derivedMismatch, struct.batch.size; golden `batch-50`.

Tests first
1. generate1214Batch: concatenates reports in input order; issues carry reportIndex; 0 or 51
   reports → struct.batch.size (thrown in Opcn1214ValidationError); fileName
   '1214_batch_<n>.txt'; summary.reports = n.
2. parse1214Batch: splits at each 9999; returns one ParseResult per report; a missing 9999 between
   reports → parse.order or parse.control.missing at the right line.
3. parse1214 given a batch → parse.multipleReports.
4. parse.occurrences (MAXIMA only; minOccurs is never enforced by the parser — the `kibbutz`
   golden has no 1020 records and must keep parsing): 4 records 1010, 6 records 1030, 2 records
   2000, 31 records 2200, 15 capital-gains records — each via a 'file' case.
5. parse.derivedMismatch: tampered code 273 vs 1029/1030; 832 = yes without 2000; 833 = no with
   appendices; wrong 1020 serial; wrong appendix number or sequence; code 297 inconsistent with 834;
   code 028 inconsistent (each a tamper case; one rule ID, path/field identifies the value).
6. Golden `batch-50` (50 minimal reports with distinct file numbers).
7. Add RuleCase kind { kind: 'batch'; fail(): unknown[]; pass(): unknown[] } (runs
   generate1214Batch and collects the thrown issues) for struct.batch.size.

Implementation
- src/api/generate.ts (batch), src/api/parse.ts (batch), src/file/parse.ts (splitting, occurrence
  limits from RecordDef.maxOccurs and layout.limits), src/validate/parse-rules.ts
  (derivedMismatch, using the same derivation functions as the normalizer).
- src/index.ts exports the batch functions.

Wiring
Public API complete except parseResponseFile.

Out of scope
Response file (H2).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): batches and parser hardening"

Done when
- Every SPEC §10.7 rule is implemented; batch goldens round-trip.
```

#### H2 — Response file parser

```text
STEP H2 — Response file parser
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
After transmission SHAAM returns shumot.shg: one line per report with file number (9), tax year (4),
response code (2) and, for codes 08/33, trailing field detail (SPEC §3.9).

Read first
- SPEC §3.9, §6.1 parseResponseFile, §6.2 ResponseRecord.

Goal
Public parseResponseFile.

Tests first (tests/api/response.test.ts)
1. A three-line file (codes 00, 05, 33 with detail) parses into three ResponseRecords with
   meanings from SPEC §3.9 and accepted only for 00.
2. Unknown code → meaning 'General error; notify SHAAM'.
3. windows-1255 bytes with Hebrew detail text decode correctly; CRLF/LF; blank lines ignored.
4. A malformed line (fewer than 15 characters or non-digit fields) throws Opcn1214ParseError with
   the line number (rule parse.lineLength / parse.numeric reused).

Implementation
- src/api/response.ts, src/response/codes.ts (code → English meaning table).
- src/index.ts exports parseResponseFile and ResponseRecord.

Wiring
Public API complete.

Out of scope
Matching responses to generated reports (callers do it by file number and year).

Verify
Run the verify bundle.

Commit: "feat(opcn1214-generator): SHAAM response file parser"

Done when
- parseResponseFile is public and tested.
```

#### H3 — Property, determinism and edge-case suite

```text
STEP H3 — Property, determinism and edge-case suite
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
Every feature exists. This step adds the broad safety net of SPEC §13.6 and §13.7.

Read first
- SPEC §8.3, §8.4, §13.6, §13.7.

Goal
Seeded randomized round trips over all record types, determinism tests and the edge-case list;
golden `hebrew-edge`.

Tests first
1. tests/fixtures/random.ts — a seeded PRNG (mulberry32) and `randomValidInput(seed)` that composes
   the builders: random subsets of optional members, 1–99 shareholders, 0–3 related companies,
   0–5 R&D investments, optional foreign appendix with breakdowns, 0–14 capital-gains appendices of
   random types, valid values for every kind (within widths, valid dates, Hebrew names).
2. tests/roundtrip/property.test.ts — 200 seeds: validate1214 is valid; generate → parse →
   canonicalize deep-equals canonicalize(input); a failing seed is printed for reproduction.
3. tests/roundtrip/determinism.test.ts — shuffled object keys, shuffled amounts order, undefined
   members → identical bytes.
4. tests/edge-cases.test.ts — every item of SPEC §13.7 as its own test.
5. Golden `hebrew-edge`.

Implementation
Tests only, plus any bug fixes they reveal (each fix gets its own focused unit test).

Wiring
Runs in the package suite.

Out of scope
New features.

Verify
Run the verify bundle. Give the property test a generous per-test timeout (e.g. 60 s) instead of
asserting its duration (CI runs on three Node versions).

Commit: "test(opcn1214-generator): property, determinism and edge-case suite"

Done when
- 200 random seeds round-trip; every SPEC §13.7 case has a test.
```

#### H4 — Release wiring

```text
STEP H4 — Release wiring
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
The package is functionally complete. It must be wired into the monorepo like the sibling
generators and documented for consumers.

Read first
- SPEC §6.4, §6.5, §12 P6, §13.4, §13.9; root package.json (build:tools), root tsconfig.json paths,
  root vitest.config.ts aliases, .changeset/, packages/shaam6111-generator/README.md (style).

Goal
Documented, releasable package.

Tests first
1. tests/rules/spec-sync.test.ts — now asserts equality: the set of RULES IDs equals the set of rule
   IDs in SPEC.md §10 tables.
2. tests/docs/readme.test.ts — every TypeScript code block in README.md preceded by `<!-- test -->` is executed
   (write each example as a self-contained snippet using minimal fixtures) and the README rule table
   equals the one rendered from RULES.
3. tests/api/exports.test.ts — final public surface per SPEC §6.4.

Implementation
- README.md — purpose, install, quick start (validate → generate), parsing, batches, response file,
  error handling (SPEC §11.4 pattern), rule table (generated by scripts/render-rules-table.ts and
  pasted between markers), versioning (SPEC §6.5), verification status (link VERIFICATION.md).
- Root wiring: add @accounter/opcn1214-generator to the root `build:tools` include list and to
  root tsconfig.json `paths`; nothing in the server yet.
- Changeset: .changeset/<name>.md with a minor bump for @accounter/opcn1214-generator describing the
  new package.
- Remove any leftover scaffolding (search for TODO, SPEC_STATUS, passWithNoTests).

Wiring
Monorepo build includes the package.

Out of scope
Server/client integration (SPEC Appendix B).

Verify
Run the verify bundle and the root `yarn build:tools`.

Commit: "chore(opcn1214-generator): release wiring and documentation"

Done when
- The package builds as part of build:tools, README examples run, and the rule catalogue equals the
  spec.
```

> **Human checkpoint CP-5 (after H4).** Every golden file in `VERIFICATION.md` is marked verified
> (or its rejection resolved). Then the package can be released and the server integration (SPEC
> Appendix B) planned.

---

### Fix-up step template (when a checkpoint fails)

```text
STEP FIX-<n> — <what shopcn rejected>
Apply the standing instructions (IMPLEMENTATION_PLAN.md, Part 3).

Context
Checkpoint <CP-n> rejected <fixture>.opcn with: "<exact checker message>".
Suspected ambiguity: SPEC §15 <A-x>.

Goal
Change the default for <A-x> to <new behaviour>, regenerate every affected golden file, and record
the outcome.

Tests first
1. Update the codec/encoder unit tests that encode the old behaviour to the new expected strings.
2. Add a regression test naming the checkpoint.

Implementation
- Change the single place that controls the behaviour (e.g. ALPHANUMERIC_PAD_SIDE).
- UPDATE_GOLDEN=1 for every golden; review the diff: only the bytes explained by the change may
  differ.
- SPEC §15: mark <A-x> as verified with the new decision; VERIFICATION.md: reset affected fixtures
  to PENDING.

Verify
Run the verify bundle.

Commit: "fix(opcn1214-generator): <short description> (verified on shopcn)"

Done when
- All tests green; affected goldens PENDING for re-verification.
```
