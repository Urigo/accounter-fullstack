import { z, ZodError } from 'zod';
import type {
  HapoalimForeignTransactionsBusiness,
  HapoalimForeignTransactionsPersonal,
  HapoalimILSTransactions,
  IsracardCardsTransactionsList,
  SwiftTransactions,
} from '@accounter/modern-poalim-scraper';
import { AmexPayloadSchema } from './payload-schemas/amex.schema.js';
import { CalPayloadSchema } from './payload-schemas/cal.schema.js';
import type { CalPayload } from './payload-schemas/cal.schema.js';
import { CurrencyRatesPayloadSchema } from './payload-schemas/currency-rates.schema.js';
import type { CurrencyRatesPayload } from './payload-schemas/currency-rates.schema.js';
import { DiscountPayloadSchema } from './payload-schemas/discount.schema.js';
import type { DiscountPayload } from './payload-schemas/discount.schema.js';
import { IsracardPayloadSchema } from './payload-schemas/isracard.schema.js';
import { MaxPayloadSchema } from './payload-schemas/max.schema.js';
import type { MaxPayload } from './payload-schemas/max.schema.js';
import { PoalimForeignPayloadSchema } from './payload-schemas/poalim-foreign.schema.js';
import { PoalimIlsPayloadSchema } from './payload-schemas/poalim-ils.schema.js';
import { PoalimSecuritiesInfoPayloadSchema } from './payload-schemas/poalim-securities-info.schema.js';
import type { PoalimSecuritiesInfoPayload } from './payload-schemas/poalim-securities-info.schema.js';
import { PoalimSecuritiesTransactionsPayloadSchema } from './payload-schemas/poalim-securities-transactions.schema.js';
import type { PoalimSecuritiesTransactionsPayload } from './payload-schemas/poalim-securities-transactions.schema.js';
import { PoalimSwiftPayloadSchema } from './payload-schemas/poalim-swift.schema.js';

export type PayloadType =
  | 'poalim-ils'
  | 'poalim-foreign'
  | 'poalim-swift'
  | 'poalim-securities-info'
  | 'poalim-securities-transactions'
  | 'isracard'
  | 'amex'
  | 'cal'
  | 'discount'
  | 'max'
  | 'currency-rates';

type PayloadMap = {
  'poalim-ils': HapoalimILSTransactions;
  'poalim-foreign': HapoalimForeignTransactionsPersonal | HapoalimForeignTransactionsBusiness;
  'poalim-swift': SwiftTransactions;
  'poalim-securities-info': PoalimSecuritiesInfoPayload;
  'poalim-securities-transactions': PoalimSecuritiesTransactionsPayload;
  isracard: IsracardCardsTransactionsList;
  amex: IsracardCardsTransactionsList;
  cal: CalPayload;
  discount: DiscountPayload;
  max: MaxPayload;
  'currency-rates': CurrencyRatesPayload;
};

/** How many individual issues a validation failure spells out before summarizing. */
const MAX_REPORTED_ISSUES = 10;

/**
 * Renders a failed parse as a list a human can act on.
 *
 * `ZodError.message` is the full issue tree as JSON — for a 150-row payload with
 * one bank-side change that is thousands of lines, and the actual problem is
 * buried. This prints `path: message` per issue, keeps the field-level messages
 * (which already name the offending value and the fix) and caps the long tail.
 */
function summariseIssues(zodError: ZodError): string {
  const lines = zodError.issues.map(issue => {
    const path = issue.path.join('.') || '(root)';
    // The field-level messages name their own field and the path already does,
    // so drop the duplicate prefix rather than printing "…NV: NV: …".
    const field = issue.path.at(-1);
    const message =
      typeof field === 'string' && issue.message.startsWith(`${field}: `)
        ? issue.message.slice(field.length + 2)
        : issue.message;
    return `  - ${path}: ${message}`;
  });

  const shown = lines.slice(0, MAX_REPORTED_ISSUES);
  const omitted = lines.length - shown.length;
  return [
    `${lines.length} issue${lines.length === 1 ? '' : 's'}:`,
    ...shown,
    ...(omitted > 0 ? [`  …and ${omitted} more.`] : []),
  ].join('\n');
}

export class PayloadValidationError extends Error {
  constructor(
    public readonly payloadType: PayloadType,
    public readonly zodError: ZodError,
  ) {
    super(`[${payloadType}] payload validation failed — ${summariseIssues(zodError)}`);
    this.name = 'PayloadValidationError';
    this.cause = zodError;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const schemas: Record<PayloadType, z.ZodType<any>> = {
  'poalim-ils': PoalimIlsPayloadSchema,
  'poalim-foreign': PoalimForeignPayloadSchema,
  'poalim-swift': PoalimSwiftPayloadSchema,
  'poalim-securities-info': PoalimSecuritiesInfoPayloadSchema,
  'poalim-securities-transactions': PoalimSecuritiesTransactionsPayloadSchema,
  isracard: IsracardPayloadSchema,
  amex: AmexPayloadSchema,
  cal: CalPayloadSchema,
  discount: DiscountPayloadSchema,
  max: MaxPayloadSchema,
  'currency-rates': CurrencyRatesPayloadSchema,
};

export function validatePayload<T extends PayloadType>(type: T, raw: unknown): PayloadMap[T] {
  const schema = schemas[type];
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new PayloadValidationError(type, result.error);
  }
  return result.data as PayloadMap[T];
}
