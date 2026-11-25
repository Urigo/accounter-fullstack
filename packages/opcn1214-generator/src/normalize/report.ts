/**
 * Normalizer (IMPLEMENTATION_PLAN.md §1.1): turns a Report1214Input into the internal
 * NormalizedReport. Internal; the public API puts the shape stage and validation in front of it.
 */
import { getLayout } from '../layout/registry.js';
import type { YearLayout } from '../layout/types.js';
import type { Report1214Input } from '../model/input.js';
import type { NormalizedReport } from '../model/normalized.js';
import type { ValidateOptions } from '../model/options.js';
import { normalizeCapitalGains } from './capital-gains/index.js';
import { normalizeCountryBreakdowns, normalizeForeignAppendix } from './foreign.js';
import { normalizeMain } from './main.js';
import { normalizeRdInvestments } from './rd-investments.js';
import { normalizeRelatedCompanies } from './related-companies.js';
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
  const foreign = input.foreignAppendix
    ? normalizeForeignAppendix(input.foreignAppendix, layout, options)
    : undefined;
  const capitalGains = normalizeCapitalGains(input.capitalGains ?? [], layout, options);
  const records = [
    main.record,
    ...normalizeRelatedCompanies(input.relatedCompanies ?? [], layout, options),
    ...normalizeShareholders(input.shareholders, layout, options),
    ...normalizeRdInvestments(input.rdInvestments ?? [], layout, options),
    ...(foreign ? [foreign.record] : []),
    ...(input.foreignAppendix
      ? normalizeCountryBreakdowns(input.foreignAppendix, layout, options)
      : []),
    ...capitalGains.records,
  ];
  // Stable: records of one type keep their order (input order; emission order for 30xx).
  records.sort((a, b) => layout.records[a.recordType].order - layout.records[b.recordType].order);
  return {
    taxYear: input.taxYear,
    layout,
    records,
    notices: [...main.notices, ...capitalGains.notices],
    omittedZeroCodes: [
      ...main.omittedZeroCodes.map(code => ({ record: '1000' as const, recordIndex: 0, code })),
      ...(foreign?.omittedZeroCodes ?? []).map(code => ({
        record: '2000' as const,
        recordIndex: 0,
        code,
      })),
      ...capitalGains.omittedZeroCodes,
    ],
  };
}
