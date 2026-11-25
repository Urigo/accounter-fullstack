# Golden file verification

Every golden `.opcn` file is uploaded unchanged to SHAAM's structure checker
(<https://secapp.taxes.gov.il/shopcn>) at the checkpoint named in its notes (SPEC §13.8,
IMPLEMENTATION_PLAN.md Part 3). `tests/golden/golden.test.ts` asserts that each file's sha256 equals
the value below, so a golden cannot change without editing this table; a changed golden goes back to
`PENDING`.

| fixture   | sha256                                                             | generated on | shopcn result | notes                      |
| --------- | ------------------------------------------------------------------ | ------------ | ------------- | -------------------------- |
| minimal   | `218b2da9e1d1c2ed58d02936fc13c2be16b26b16981cd45ae9b88869253a796d` | 2026-11-17   | PENDING       | Checkpoint CP-1 (after C6) |
| main-full | `157ddbc08af59ca535540bac0c45c1223b82313d6fabc8314ee2c349cf2dd9c0` | 2026-11-17   | PENDING       | Checkpoint CP-2 (after D5) |
| kibbutz   | `fb59acc9b4d448b7766edac00e8f6d52ee12777664c01094fc3cb05926c6bc0b` | 2026-11-17   | PENDING       | Checkpoint CP-2 (after D5) |
