# opcn1214-generator Package

SHAAM form 1214 OPCN generator, validator and parser. Specification: `documentation/SPEC.md`.

## Layout data

- `documentation/layout/<year>/*.csv` is the source of truth for every record, field and code.
- `yarn workspace @accounter/opcn1214-generator generate:layout` regenerates
  `src/layout/<year>/layout.generated.ts` and `src/model/codes.generated.ts`. Never hand-edit a
  `*.generated.ts` file; `tests/layout/codegen-sync.test.ts` fails when they drift from the CSVs.
  Adding a tax year: SPEC §14.

## Rules

Every rule ID lives in three places, kept equal by tests:

1. `RULES` in `src/validate/rules.ts` (metadata);
2. a row in the SPEC §10 tables with the same severity and source (`tests/rules/spec-sync.test.ts`);
3. a pass/fail case in `RULE_CASES` (`tests/rules/cases.ts`, typed per `RuleId`).

After changing `RULES`, run `yarn workspace @accounter/opcn1214-generator render:rules` to refresh
the README rule table (`tests/docs/readme.test.ts` compares it). README blocks marked
`<!-- test -->` are executed by that test. A new error rule is a major version (SPEC §6.5).

## Golden files

`tests/fixtures/golden/*.opcn` are windows-1255 bytes written by the generator, never by hand. The
workflow (`UPDATE_GOLDEN=1`, sha256 in `VERIFICATION.md`, shopcn verification) is in
[`tests/fixtures/golden/README.md`](tests/fixtures/golden/README.md).

## Verify

```bash
yarn workspace @accounter/opcn1214-generator typecheck
yarn workspace @accounter/opcn1214-generator build # lint --fix, then bob
yarn eslint packages/opcn1214-generator/src
yarn prettier --check packages/opcn1214-generator
yarn workspace @accounter/opcn1214-generator test --run # not the root `yarn test`: it needs Postgres
```
