import { z, ZodError } from 'zod';
import { AmexPayloadSchema } from './payload-schemas/amex.schema.js';
import type { AmexPayload } from './payload-schemas/amex.schema.js';
import { CalPayloadSchema } from './payload-schemas/cal.schema.js';
import type { CalPayload } from './payload-schemas/cal.schema.js';
import { CurrencyRatesPayloadSchema } from './payload-schemas/currency-rates.schema.js';
import type { CurrencyRatesPayload } from './payload-schemas/currency-rates.schema.js';
import { DiscountPayloadSchema } from './payload-schemas/discount.schema.js';
import type { DiscountPayload } from './payload-schemas/discount.schema.js';
import { IsracardPayloadSchema } from './payload-schemas/isracard.schema.js';
import type { IsracardPayload } from './payload-schemas/isracard.schema.js';
import { MaxPayloadSchema } from './payload-schemas/max.schema.js';
import type { MaxPayload } from './payload-schemas/max.schema.js';
import { PoalimForeignPayloadSchema } from './payload-schemas/poalim-foreign.schema.js';
import type { PoalimForeignPayload } from './payload-schemas/poalim-foreign.schema.js';
import { PoalimIlsPayloadSchema } from './payload-schemas/poalim-ils.schema.js';
import type { PoalimIlsPayload } from './payload-schemas/poalim-ils.schema.js';
import { PoalimSwiftPayloadSchema } from './payload-schemas/poalim-swift.schema.js';
import type { PoalimSwiftPayload } from './payload-schemas/poalim-swift.schema.js';

export type PayloadType =
  | 'poalim-ils'
  | 'poalim-foreign'
  | 'poalim-swift'
  | 'isracard'
  | 'amex'
  | 'cal'
  | 'discount'
  | 'max'
  | 'currency-rates';

type PayloadMap = {
  'poalim-ils': PoalimIlsPayload;
  'poalim-foreign': PoalimForeignPayload;
  'poalim-swift': PoalimSwiftPayload;
  isracard: IsracardPayload;
  amex: AmexPayload;
  cal: CalPayload;
  discount: DiscountPayload;
  max: MaxPayload;
  'currency-rates': CurrencyRatesPayload;
};

export class PayloadValidationError extends Error {
  constructor(
    public readonly payloadType: PayloadType,
    public readonly zodError: ZodError,
  ) {
    super(`[${payloadType}] payload validation failed: ${zodError.message}`);
    this.name = 'PayloadValidationError';
    this.cause = zodError;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const schemas: Record<PayloadType, z.ZodType<any>> = {
  'poalim-ils': PoalimIlsPayloadSchema,
  'poalim-foreign': PoalimForeignPayloadSchema,
  'poalim-swift': PoalimSwiftPayloadSchema,
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
