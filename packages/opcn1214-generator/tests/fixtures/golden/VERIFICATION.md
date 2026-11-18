# Golden file verification

Every golden `.opcn` file is uploaded unchanged to SHAAM's structure checker
(<https://secapp.taxes.gov.il/shopcn>) at the checkpoint named in its notes (SPEC §13.8,
IMPLEMENTATION_PLAN.md Part 3). `tests/golden/golden.test.ts` asserts that each file's sha256 equals
the value below, so a golden cannot change without editing this table; a changed golden goes back to
`PENDING`.

| fixture           | sha256                                                             | generated on | shopcn result                        | notes                                                                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------ | ------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| minimal           | `218b2da9e1d1c2ed58d02936fc13c2be16b26b16981cd45ae9b88869253a796d` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-17) | Checkpoint CP-1 (after C6)                                                                                                                                                                                                                                          |
| main-full         | `8afe6c87ed3a128209a9121ea6a5e850cb6b9314c34b510860f112a30462af13` | 2026-11-18   | PENDING                              | CP-2 rejected 940000001 (FIX-1); 2026-11-18 rejected "הערך '940000003' אינו תקין במילוי 'תיק ניכויים'" (FIX-2: 1000@225 = 951400001, A-28); FIX-2 file rejected 2026-11-18: "הערך '14/05/2023' אינו תקין במילוי 'תאריך מפעל מוטב'" (field 852) — waiting for probes |
| kibbutz           | `4d3468aaf6df43376b8ac743b4ea6cf7bc056ea0ac60dc2e1f30b33408433629` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-18) | CP-2 (2026-11-17) rejected: "שגיאה בקובץ, ספרת בקורת שגויה" (1000@137 = 570000001); regenerated in FIX-1; passed 2026-11-18                                                                                                                                         |
| related-and-rd    | `84521593f75d61eea765adac8f37a0e56d6e8b702ef393773e67ee509d45e2b9` | 2026-11-18   | VERIFIED (shopcn passed, 2026-11-18) | CP-3 rejected 510000001 (FIX-1); 2026-11-18 rejected the Latin 1010@139 name; FIX-2: Hebrew names in 1010@139 and 1030@138 (A-29); passed 2026-11-18                                                                                                                |
| foreign           | `4ffc923fc10f39e21468c997911dda5cca4a4e257918655ae877ff0beaa7166e` | 2026-11-17   | VERIFIED (2026-11-17)                | Checkpoint CP-3                                                                                                                                                                                                                                                     |
| cg-60             | `ede2f5fb5b45eb72155999be274882d7ff9a262825f34aa1d5a6196bc04e7382` | 2026-11-18   | VERIFIED (shopcn passed, 2026-11-18) | 2026-11-18 rejected all 21 code-amount pairs; FIX-2: code 099 dropped, 20 codes (A-30); passed 2026-11-18                                                                                                                                                           |
| cg-63             | `1261b55f1424cf354d9e6501327363f4406463966849992ecefbe9149b76f0bb` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-18) | Checkpoint CP-4; passed 2026-11-18                                                                                                                                                                                                                                  |
| cg-64             | `0db7f022d71df931b4802138e2efe9044a09b9d53420b570eba2c7f29c1a3413` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-18) | Checkpoint CP-4; passed 2026-11-18                                                                                                                                                                                                                                  |
| cg-65             | `34b398317ea9f801ced1b240277794db521c5907f86e9e9b20c2d547e5c6a08e` | 2026-11-18   | VERIFIED (shopcn passed, 2026-11-18) | 2026-11-18 rejected all 21 code-amount pairs; FIX-2: code 099 dropped, 20 codes (A-30); passed 2026-11-18                                                                                                                                                           |
| cg-66             | `caeac73143c542e4a53bef24dcd2f53798ad064597f3bdb6bc7d8f58b2865897` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-18) | Checkpoint CP-4; passed 2026-11-18                                                                                                                                                                                                                                  |
| cg-27             | `cf51a279262bcb77f24e7db2aa47894e1024c12809c3f34e46e4bd85f05de083` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-18) | Checkpoint CP-4; passed 2026-11-18                                                                                                                                                                                                                                  |
| cg-50             | `b3d39d7e819f5e6267e802bd28f24e8c0d4a2aa5c0cfea5750f07b8a53a6d466` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-18) | Checkpoint CP-4; passed 2026-11-18                                                                                                                                                                                                                                  |
| cg-51             | `c4fd1206c74d188984057377508b30e4fe0d61bd2227d2f8e158a03ad62c699d` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-18) | Checkpoint CP-4; passed 2026-11-18                                                                                                                                                                                                                                  |
| cg-54             | `806a36e9c527e51ffb236ee36f8231663bd5e34f5ba62908f15f60352a22f3d8` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-18) | Checkpoint CP-4; passed 2026-11-18                                                                                                                                                                                                                                  |
| cg-77             | `820d46707dd5e1aa5a28c9eadcd28b18dc543467604320ff3ee9abdccd06c4d2` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-18) | Checkpoint CP-4; passed 2026-11-18                                                                                                                                                                                                                                  |
| capital-gains-max | `2b0c83974395208f23a4fd3afbcb680676a5c2c2d3033433ec90b322ef88330e` | 2026-11-18   | PENDING                              | 2026-11-18 rejected 3077 code 092 = 2 (FIX-2: 092 = 1, A-31); FIX-2 file rejected 2026-11-18: "חוסר התאמה בין הנתונים למספר יתרות השבחה (רווח הון 77 ,3)"; FIX-3: improvement 2 of the third 3077 given an expense (A-32) — re-check                                |
| hebrew-edge       | `a59deb0509622bb51e1d3817ae2a6bb0cb867f2325c755d8b8c91f8925d9a7b1` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-18) | Checkpoint CP-5 (Hebrew text edges, H3); passed 2026-11-18                                                                                                                                                                                                          |
| batch-50          | `169134da3746c719275185bf66642480525e222aa777bd657dd0c9efde5dfe50` | 2026-11-17   | VERIFIED (shopcn passed, 2026-11-18) | Checkpoint CP-5; passed 2026-11-18                                                                                                                                                                                                                                  |

## shopcn upload of 2026-11-18 (FIX-2)

shopcn reports only the first error of a file. Passed: `kibbutz`, `cg-27`, `cg-50`, `cg-51`,
`cg-54`, `cg-63`, `cg-64`, `cg-66`, `cg-77`, `batch-50` (all 50 reports) and `hebrew-edge`. The five
rejected files were changed in FIX-2 (SPEC §15 A-28 to A-31) and regenerated; only the bytes named
here changed:

- `main-full`: 1000@225–233 (withholding file 940000003 → 951400001).
- `related-and-rd`: 1010@139–188 of the third related company and 1030@138–187 of the fifth R&D
  investment (Latin names → `פורין אפיליאייט לימיטד`, `סטארט-אפ מחקר ופיתוח בע"מ`).
- `cg-60`, `cg-65`: the last code-amount pair of the 30xx section, 1421–1433 (code 099, the last
  code in ascending order, left out; it takes part in no rule or derivation, so the section only
  loses its last pair and nothing else moves).
- `capital-gains-max`: 3077@1177 of the third 3077 appendix (code 092 value 2 → 1).

## shopcn upload of 2026-11-18 (FIX-3)

The five files regenerated in FIX-2 were uploaded again. Passed: `cg-60`, `cg-65` and
`related-and-rd` (bytes unchanged, now VERIFIED). Rejected:

- `capital-gains-max`: "חוסר התאמה בין הנתונים למספר יתרות השבחה (רווח הון 77 ,3)". The third 3077
  appendix (appendix 3) declared 2 improvements at 3077@245, but its second improvement had only an
  accumulated depreciation and no expense; shopcn counts only improvements with an expense (SPEC §15
  A-32, `cg.improvements.expense`). FIX-3 gave it an expense of 15,000 and a code-50 amount of
  11,999.5. Only line 16 (the third 3077 record) changed: 3077@286–287, inside the expense of
  improvement 2 (281–292, `000000000000` → `000001500000`), and 3077@1201–1202, inside the amount of
  code 502 (1196–1207, `000000299950` → `000001199950`). PENDING.
- `main-full`: "הערך '14/05/2023' אינו תקין במילוי 'תאריך מפעל מוטב'" (1000@852, the
  beneficiary-enterprise notice date). Not changed in FIX-3 (waiting for probes); PENDING, bytes
  unchanged.
