# Golden files

Byte-level fixtures of the generator (SPEC §13.5). Each fixture is a pair:

- `<name>.input.ts` exports `input` (a typed `Report1214Input`) and `options` (with a fixed `today`,
  so the output never depends on the clock);
- `<name>.opcn` is the file `generate1214(input, options)` produces, as windows-1255 bytes with CRLF
  line endings. It is binary for git (`.gitattributes`), so line endings are never converted.

`tests/golden/golden.test.ts` generates every fixture and compares the bytes with the committed
`.opcn` file. It also checks that the file's sha256 equals its row in
[`VERIFICATION.md`](VERIFICATION.md), and that the table lists exactly the fixtures present.

## Adding or changing a golden file

Only a step that intentionally adds or changes golden files does this. Never edit a `.opcn` file by
hand.

1. Add or change `<name>.input.ts`.
2. Write the `.opcn` files from the generator:

   ```sh
   UPDATE_GOLDEN=1 yarn workspace @accounter/opcn1214-generator test --run tests/golden
   ```

   The run fails on the sha256 check and prints the new hash.

3. Put that hash in the fixture's `VERIFICATION.md` row, with today's date in `generated on` and
   `PENDING` as the shopcn result (a changed golden goes back to `PENDING`, even if it was
   verified).
4. Run the tests again without `UPDATE_GOLDEN`; they must pass.

A golden file may only change before the first release or with a major version (SPEC §6.5).
