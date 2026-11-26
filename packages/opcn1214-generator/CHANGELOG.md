# @accounter/opcn1214-generator

## 0.2.0

### Minor Changes

- [#5076](https://github.com/Urigo/accounter-fullstack/pull/5076) [`62e60f7`](https://github.com/Urigo/accounter-fullstack/commit/62e60f7a15fe1ae0f3c1a41b626e7375e74d1f94) Thanks [@gilgardosh](https://github.com/gilgardosh)! - New package: generate, validate and parse SHAAM form 1214 (Israeli corporate annual return) OPCN
  files for tax years 2024 and 2025. `validate1214` returns every error and warning with a stable rule
  ID and input path, `generate1214` writes the windows-1255 file, `generate1214Batch` and
  `parse1214Batch` handle OPCN batch files of up to 50 reports, `parse1214` reads a file back into
  the typed input, and `parseResponseFile` reads SHAAM's response file (`shumot.shg`). The rule
  catalogue is exported as `RULES`.

### Patch Changes

- [#5039](https://github.com/Urigo/accounter-fullstack/pull/5039) [`2f28e2e`](https://github.com/Urigo/accounter-fullstack/commit/2f28e2e0ff970ab437f67f0aaf76f7de7e72a5ae) Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
    - Added dependency [`iconv-lite@0.7.3` ↗︎](https://www.npmjs.com/package/iconv-lite/v/0.7.3) (to `dependencies`)

- [#5035](https://github.com/Urigo/accounter-fullstack/pull/5035) [`c74729f`](https://github.com/Urigo/accounter-fullstack/commit/c74729f60ba556926deb5b68a601cf61cb52142f) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Add the developer specification, the implementation plan and the verified 2024 record layout data
  (CSV, extracted from SHAAM's form 1214 specification) for the form 1214 OPCN generator.
