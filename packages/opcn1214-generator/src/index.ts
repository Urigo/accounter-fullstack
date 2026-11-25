/**
 * @accounter/opcn1214-generator: SHAAM form 1214 (OPCN) generator, validator and parser.
 * Public API (SPEC §6.4).
 */
export { generate1214, type GenerateResult } from './api/generate.js';
export { parse1214, type ParseResult } from './api/parse.js';
export { validate1214, type ValidationResult } from './api/validate.js';
export { getLayout, supportedTaxYears } from './layout/registry.js';
export {
  Opcn1214Error,
  Opcn1214InternalError,
  Opcn1214ParseError,
  Opcn1214UnsupportedYearError,
  Opcn1214ValidationError,
} from './errors.js';
export { RULES, type RuleId, type RuleMeta } from './validate/rules.js';
export type {
  CodeDef,
  CodeKind,
  EnumValue,
  FieldDef,
  FieldKind,
  RecordDef,
  RecordType,
  Requirement,
  YearLayout,
} from './layout/types.js';
export type {
  CompanyDetails,
  Declarations,
  IsoDate,
  Phone,
  PhonePrefix,
  PreparerDetails,
  Report1214Input,
  Shareholder,
  SupportedTaxYear,
} from './model/input.js';
export type {
  CapitalGainsCode,
  CapitalGainsSymbol,
  CountryBreakdownCode,
  CountryCode,
  DerivedMainCode,
  ForeignAppendixCode,
  MainFormCode,
  MainFormInputCode,
} from './model/codes.generated.js';
export type { GenerateOptions, ParseOptions, ValidateOptions } from './model/options.js';
export type { Issue, Severity } from './validate/issue.js';
