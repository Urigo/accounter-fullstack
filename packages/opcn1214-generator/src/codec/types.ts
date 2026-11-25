/**
 * Codec contract (IMPLEMENTATION_PLAN.md §1.2): every field kind has one codec that encodes a
 * model value into the exact field width and decodes it back. Internal; not exported from the
 * package entry point.
 */
import type { CodeKind, EnumValue, FieldKind } from '../layout/types.js';

/** A field value inside the internal model (value conventions per kind: plan §1.2). */
export type Primitive = string | number | boolean | undefined;

/** What a codec needs to know about the field or code it encodes. */
export interface FieldShape {
  length: number;
  type: 'numeric' | 'alphanumeric';
  kind: FieldKind | CodeKind;
  values?: readonly EnumValue[];
}

export interface Codec {
  /**
   * Returns exactly `shape.length` characters. Throws Opcn1214InternalError for a value that
   * validation should have rejected (encoders never repair data).
   */
  encode(value: Primitive, shape: FieldShape): string;
  /**
   * Inverse of encode. All-zero text decodes to 0 (digit-string kinds: to the all-zero string) and
   * all-space text in an alphanumeric field to undefined; spaces in a numeric field are not
   * digits (CodecDecodeError 'numeric'). The record codec decides whether 0 means "absent". Throws
   * CodecDecodeError for raw text that cannot be decoded; the parser converts it into a parse.*
   * issue.
   */
  decode(raw: string, shape: FieldShape): Primitive;
}

export type CodecDecodeReason = 'numeric' | 'date' | 'format' | 'section' | 'length';

/** Raw text that cannot be decoded. */
export class CodecDecodeError extends Error {
  readonly reason: CodecDecodeReason;
  /** 0-based offset within the decoded text (field, section or line). */
  readonly offset: number;

  constructor(reason: CodecDecodeReason, offset: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CodecDecodeError';
    this.reason = reason;
    this.offset = offset;
  }
}
