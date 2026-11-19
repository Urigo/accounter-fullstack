/**
 * Normalizer (IMPLEMENTATION_PLAN.md §1.1): turns a Report1214Input into the internal
 * NormalizedReport. Internal; the public API puts the shape stage and validation in front of it.
 */
import { getLayout } from '../layout/registry.js';
import type { YearLayout } from '../layout/types.js';
import type { Report1214Input } from '../model/input.js';
import type { NormalizedReport } from '../model/normalized.js';
import type { ValidateOptions } from '../model/options.js';
import { normalizeMain } from './main.js';
import { normalizeShareholders } from './shareholders.js';

/**
 * The NormalizedReport of `input`: records in canonical order (SPEC §3.3), zero codes omitted per
 * SPEC §4.5. `layout` defaults to the layout of `input.taxYear`.
 */
export function normalizeReport(
  input: Report1214Input,
  layout: YearLayout = getLayout(input.taxYear),
  options: ValidateOptions = {},
): NormalizedReport {
  const main = normalizeMain(input, layout, options);
  const records = [main.record, ...normalizeShareholders(input.shareholders, layout)];
  // Stable: records of one type keep their input order.
  records.sort((a, b) => layout.records[a.recordType].order - layout.records[b.recordType].order);
  return {
    taxYear: input.taxYear,
    layout,
    records,
    notices: [],
    omittedZeroCodes: main.omittedZeroCodes.map(code => ({
      record: '1000',
      recordIndex: 0,
      code,
    })),
  };
}
