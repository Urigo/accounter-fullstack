---
'@accounter/shaam-uniform-format-generator': patch
---

* **New Integration Test Suite**: I've added a comprehensive integration test suite for validating the uniform format report generation process using real-world fixture files.
* **Round-trip Validation**: I've implemented tests to perform a full round-trip: parsing existing `BKMVDATA.txt` and `ini.txt` fixtures, generating new reports from the parsed data, and then re-parsing the generated reports to ensure data integrity and consistency.
* **Data Parsing and Generation Coverage**: The tests cover parsing and generation of various record types (A100, B100, B110, C100, D110, D120, M100, Z900 for `BKMVDATA.txt` and A000, A000Sum for `ini.txt`), ensuring broad coverage of the uniform format specification.
* **Robustness Testing**: I've included tests for handling edge cases such as different line endings, whitespace, and gracefully skipping invalid or unknown record types during parsing, enhancing the robustness of the parsing logic.
* **Monetary Precision Verification**: A test has been added to ensure that monetary values from B100 records are correctly parsed and can be part of the round-trip process, implying that precision is maintained throughout data transformation.

