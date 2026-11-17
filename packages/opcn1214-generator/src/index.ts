/**
 * @accounter/opcn1214-generator: SHAAM form 1214 (OPCN) generator, validator and parser.
 * Public API (SPEC §6.4).
 */
export { getLayout, supportedTaxYears } from './layout/registry.js';
export { Opcn1214Error, Opcn1214InternalError, Opcn1214UnsupportedYearError } from './errors.js';
export type {
  CodeDef,
  FieldDef,
  FieldKind,
  RecordDef,
  RecordType,
  YearLayout,
} from './layout/types.js';
export type { Issue, Severity } from './validate/issue.js';
