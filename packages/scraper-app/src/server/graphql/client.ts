import { GraphQLClient } from 'graphql-request';
import type { AmexPayload } from '../payload-schemas/amex.schema.js';
import type { CalPayload } from '../payload-schemas/cal.schema.js';
import type { CurrencyRatesPayload } from '../payload-schemas/currency-rates.schema.js';
import type { DiscountPayload } from '../payload-schemas/discount.schema.js';
import type { IsracardPayload } from '../payload-schemas/isracard.schema.js';
import type { MaxPayload } from '../payload-schemas/max.schema.js';
import type { PoalimForeignPayload } from '../payload-schemas/poalim-foreign.schema.js';
import type { PoalimIlsPayload } from '../payload-schemas/poalim-ils.schema.js';
import type { PoalimSwiftPayload } from '../payload-schemas/poalim-swift.schema.js';
import {
  amexVars,
  calVars,
  currencyRatesVars,
  discountVars,
  isracardVars,
  maxVars,
  poalimForeignVars,
  poalimIlsVars,
  poalimSwiftVars,
  UPLOAD_AMEX,
  UPLOAD_CAL,
  UPLOAD_CURRENCY_RATES,
  UPLOAD_DISCOUNT,
  UPLOAD_ISRACARD,
  UPLOAD_MAX,
  UPLOAD_POALIM_FOREIGN,
  UPLOAD_POALIM_ILS,
  UPLOAD_POALIM_SWIFT,
  type UploadResult,
} from './mutations.js';

type GqlResponse<K extends string> = Record<K, UploadResult>;

function extractResult<K extends string>(data: GqlResponse<K>, key: K): UploadResult {
  const result = data[key];
  if (!result) throw new Error(`GraphQL response missing field: ${key}`);
  return result;
}

export type { UploadResult };

export function createUploadClient(serverUrl: string, apiKey: string) {
  const gql = new GraphQLClient(serverUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  async function request<K extends string>(
    doc: string,
    vars: Record<string, unknown>,
    key: K,
  ): Promise<UploadResult> {
    const data = await gql.request<GqlResponse<K>>(doc, vars);
    return extractResult(data, key);
  }

  return {
    async uploadPoalimIls(payload: PoalimIlsPayload): Promise<UploadResult> {
      return request(UPLOAD_POALIM_ILS, poalimIlsVars(payload), 'uploadPoalimIlsTransactions');
    },

    async uploadPoalimForeign(payload: PoalimForeignPayload): Promise<UploadResult> {
      return request(
        UPLOAD_POALIM_FOREIGN,
        poalimForeignVars(payload),
        'uploadPoalimForeignTransactions',
      );
    },

    async uploadPoalimSwift(payload: PoalimSwiftPayload): Promise<UploadResult> {
      return request(
        UPLOAD_POALIM_SWIFT,
        poalimSwiftVars(payload),
        'uploadPoalimSwiftTransactions',
      );
    },

    async uploadIsracard(payloads: IsracardPayload[]): Promise<UploadResult> {
      return request(UPLOAD_ISRACARD, isracardVars(payloads), 'uploadIsracardTransactions');
    },

    async uploadAmex(payloads: AmexPayload[]): Promise<UploadResult> {
      return request(UPLOAD_AMEX, amexVars(payloads), 'uploadAmexTransactions');
    },

    async uploadCal(payload: CalPayload): Promise<UploadResult> {
      return request(UPLOAD_CAL, calVars(payload), 'uploadCalTransactions');
    },

    async uploadDiscount(payload: DiscountPayload): Promise<UploadResult> {
      return request(UPLOAD_DISCOUNT, discountVars(payload), 'uploadDiscountTransactions');
    },

    async uploadMax(payload: MaxPayload): Promise<UploadResult> {
      return request(UPLOAD_MAX, maxVars(payload), 'uploadMaxTransactions');
    },

    async uploadCurrencyRates(payload: CurrencyRatesPayload): Promise<UploadResult> {
      return request(UPLOAD_CURRENCY_RATES, currencyRatesVars(payload), 'uploadCurrencyRates');
    },
  };
}

export type UploadClient = ReturnType<typeof createUploadClient>;
