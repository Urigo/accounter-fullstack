/** Options of validation and generation (SPEC §6.2). */
import type { IsoDate } from './input.js';

export interface ValidateOptions {
  /** How non-integer amounts are handled. Default 'reject' (error field.integer). */
  rounding?: 'reject' | 'halfUp';
  /** Used when input.meta.saveDate is absent. Default: today in Asia/Jerusalem. */
  today?: () => IsoDate;
}

export type GenerateOptions = ValidateOptions;

/** Options of parsing (SPEC §6.2). */
export interface ParseOptions {
  /** Encoding of a Uint8Array input. Default 'windows-1255'. Strings are taken as already decoded. */
  encoding?: 'windows-1255' | 'utf-8';
}
