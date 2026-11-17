/** Options of validation and generation (SPEC §6.2). */
import type { IsoDate } from './input.js';

export interface ValidateOptions {
  /** How non-integer amounts are handled. Default 'reject' (error field.integer). */
  rounding?: 'reject' | 'halfUp';
  /** Used when input.meta.saveDate is absent. Default: today in Asia/Jerusalem. */
  today?: () => IsoDate;
}

export type GenerateOptions = ValidateOptions;
