# @accounter/opcn1214-generator

Generator, validator and parser for SHAAM's **form 1214** (Israeli corporate annual return) OPCN
file: the fixed-width file that representatives upload through OPCN or the identified-representative
internet service.

> **Status: specification only.** Implementation has not started. Everything a developer needs is in
> [`documentation/SPEC.md`](documentation/SPEC.md).

## Contents

| Path                                                                                       | What it is                                                              |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [`documentation/SPEC.md`](documentation/SPEC.md)                                           | Developer specification: format, API, input model, rules, tests         |
| [`documentation/layout/2024/`](documentation/layout/2024/)                                 | Every record field and code of the 2024 layout as CSV (source of truth) |
| [`documentation/layout/README.md`](documentation/layout/README.md)                         | CSV column reference and provenance                                     |
| [`documentation/specifications/1214-2024.pdf`](documentation/specifications/1214-2024.pdf) | SHAAM's normative specification (Hebrew, 71 pages)                      |
| [`documentation/tools/extract_layout.py`](documentation/tools/extract_layout.py)           | PDF → layout extractor and CSV diff, for yearly spec updates            |

## Planned API (see SPEC §6)

```ts
import { generate1214, validate1214 } from '@accounter/opcn1214-generator'

const result = validate1214(input) // never throws; returns every error and warning
if (result.valid) {
  const { bytes, fileName } = generate1214(input) // windows-1255 file, ready to upload
}
```

## License

MIT
