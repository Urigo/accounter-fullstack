# Golden file verification

Every golden `.opcn` file is uploaded unchanged to SHAAM's structure checker
(<https://secapp.taxes.gov.il/shopcn>) at the checkpoint named in its notes (SPEC §13.8,
IMPLEMENTATION_PLAN.md Part 3). `tests/golden/golden.test.ts` asserts that each file's sha256 equals
the value below, so a golden cannot change without editing this table; a changed golden goes back to
`PENDING`.

| fixture | sha256                                                             | generated on | shopcn result | notes                      |
| ------- | ------------------------------------------------------------------ | ------------ | ------------- | -------------------------- |
| minimal | `218b2da9e1d1c2ed58d02936fc13c2be16b26b16981cd45ae9b88869253a796d` | 2026-11-17   | PENDING       | Checkpoint CP-1 (after C6) |
