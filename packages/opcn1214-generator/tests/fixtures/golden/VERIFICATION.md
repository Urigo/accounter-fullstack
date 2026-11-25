# Golden file verification

Every golden `.opcn` file is uploaded unchanged to SHAAM's structure checker
(<https://secapp.taxes.gov.il/shopcn>) at the checkpoint named in its notes (SPEC §13.8,
IMPLEMENTATION_PLAN.md Part 3). `tests/golden/golden.test.ts` asserts that each file's sha256 equals
the value below, so a golden cannot change without editing this table; a changed golden goes back to
`PENDING`.

| fixture        | sha256                                                             | generated on | shopcn result                        | notes                                                                                                                                            |
| -------------- | ------------------------------------------------------------------ | ------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| minimal        | `218b2da9e1d1c2ed58d02936fc13c2be16b26b16981cd45ae9b88869253a796d` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-17) | Checkpoint CP-1 (after C6)                                                                                                                       |
| main-full      | `c2af3d0d71081209c5ec7a6ddb30ce3688492411592b5465af08b81fe250fed0` | 2026-11-17   | PENDING                              | CP-2 (2026-11-17) rejected: "הערך '940000001' אינו תקין במילוי 'תיק ניכויים'" (1000@225 check digit); regenerated in FIX-1 — re-check            |
| kibbutz        | `4d3468aaf6df43376b8ac743b4ea6cf7bc056ea0ac60dc2e1f30b33408433629` | 2026-11-17   | PENDING                              | CP-2 (2026-11-17) rejected: "שגיאה בקובץ, ספרת בקורת שגויה" (1000@137 = 570000001); regenerated in FIX-1 — re-check                              |
| related-and-rd | `dd939fbf023259e1ed70f46ffedb874c5b3ac705131c4d9cdd917d3e7f76107d` | 2026-11-17   | PENDING                              | CP-3 (2026-11-17) rejected: "הערך '510000001' אינו תקין במילוי 'חברות קשורות: תיק חברה'" (1010@189 check digit); regenerated in FIX-1 — re-check |
| foreign        | `4ffc923fc10f39e21468c997911dda5cca4a4e257918655ae877ff0beaa7166e` | 2026-11-17   | VERIFIED (2026-11-17)                | Checkpoint CP-3                                                                                                                                  |
| cg-60          | `2b9116e105d4c2251a6e14e3d71ca20aa9a48f589a04e053e8c9cd1594b38794` | 2026-11-17   | PENDING                              | Checkpoint CP-4                                                                                                                                  |
| cg-63          | `1261b55f1424cf354d9e6501327363f4406463966849992ecefbe9149b76f0bb` | 2026-11-17   | PENDING                              | Checkpoint CP-4                                                                                                                                  |
| cg-64          | `0db7f022d71df931b4802138e2efe9044a09b9d53420b570eba2c7f29c1a3413` | 2026-11-17   | PENDING                              | Checkpoint CP-4                                                                                                                                  |
