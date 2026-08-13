import { GraphQLClient } from 'graphql-request';
import type {
  HapoalimForeignTransactionsBusiness,
  HapoalimForeignTransactionsPersonal,
  HapoalimILSTransactions,
  IsracardCardsTransactionsList,
} from '@accounter/modern-poalim-scraper';
import type { UploadPoalimIlsTransactionsMutation } from '../gql/index.js';
import type { CalPayload } from '../payload-schemas/cal.schema.js';
import type { CurrencyRatesPayload } from '../payload-schemas/currency-rates.schema.js';
import type { DiscountPayload } from '../payload-schemas/discount.schema.js';
import type { MaxPayload } from '../payload-schemas/max.schema.js';
import type { PoalimSecuritiesInfoPayload } from '../payload-schemas/poalim-securities-info.schema.js';
import type { PoalimSecuritiesTransactionsPayload } from '../payload-schemas/poalim-securities-transactions.schema.js';
import type {
  ForeignAccountData,
  OtsarHahayalCreditCardData,
  OtsarHahayalIlsData,
} from '../scrapers/otsar-hahayal.js';
import type { DecoratedSwiftTransactions } from '../scrapers/poalim.js';
import {
  amexVars,
  calVars,
  currencyRatesVars,
  discountVars,
  isracardVars,
  maxVars,
  otsarCreditCardVars,
  otsarForeignVars,
  otsarIlsVars,
  poalimForeignVars,
  poalimIlsVars,
  poalimSecuritiesInfoVars,
  poalimSecuritiesTransactionsVars,
  poalimSwiftVars,
  UPLOAD_AMEX,
  UPLOAD_CAL,
  UPLOAD_CURRENCY_RATES,
  UPLOAD_DISCOUNT,
  UPLOAD_ISRACARD,
  UPLOAD_MAX,
  UPLOAD_OTSAR_CREDITCARD,
  UPLOAD_OTSAR_FOREIGN,
  UPLOAD_OTSAR_ILS,
  UPLOAD_POALIM_FOREIGN,
  UPLOAD_POALIM_ILS,
  UPLOAD_POALIM_SECURITIES,
  UPLOAD_POALIM_SECURITIES_TRANSACTIONS,
  UPLOAD_POALIM_SWIFT,
} from './mutations.js';

type GqlResponse<K extends string> = Record<K, ScraperUploadResult>;

function extractResult<K extends string>(data: GqlResponse<K>, key: K): ScraperUploadResult {
  const result = data[key];
  if (!result) throw new Error(`GraphQL response missing field: ${key}`);
  return result;
}

type ScraperUploadResult = UploadPoalimIlsTransactionsMutation['uploadPoalimIlsTransactions'];
type InsertedTransactionSummary = ScraperUploadResult['insertedTransactions'][number];
type ChangedTransaction = ScraperUploadResult['changedTransactions'][number];

export type { ScraperUploadResult, InsertedTransactionSummary, ChangedTransaction };

export function createUploadClient(serverUrl: string, apiKey: string) {
  const gql = new GraphQLClient(serverUrl, {
    headers: { 'X-API-Key': apiKey },
  });

  async function request<K extends string>(
    doc: string,
    vars: Record<string, unknown>,
    key: K,
  ): Promise<ScraperUploadResult> {
    const data = await gql.request<GqlResponse<K>>(doc, vars);
    return extractResult(data, key);
  }

  return {
    async uploadPoalimIls(payload: HapoalimILSTransactions): Promise<ScraperUploadResult> {
      return request(UPLOAD_POALIM_ILS, poalimIlsVars(payload), 'uploadPoalimIlsTransactions');
    },

    async uploadPoalimForeign(
      payload: HapoalimForeignTransactionsPersonal | HapoalimForeignTransactionsBusiness,
      bankAccount: { bankNumber: number; branchNumber: number; accountNumber: number },
    ): Promise<ScraperUploadResult> {
      return request(
        UPLOAD_POALIM_FOREIGN,
        poalimForeignVars(payload, bankAccount),
        'uploadPoalimForeignTransactions',
      );
    },

    async uploadPoalimSwift(
      payload: DecoratedSwiftTransactions,
      bankAccount: { bankNumber: number; branchNumber: number; accountNumber: number },
    ): Promise<ScraperUploadResult> {
      return request(
        UPLOAD_POALIM_SWIFT,
        poalimSwiftVars(payload, bankAccount),
        'uploadPoalimSwiftTransactions',
      );
    },

    async uploadPoalimSecuritiesInfo(
      payload: PoalimSecuritiesInfoPayload,
      bankAccount: { bankNumber: number; branchNumber: number; accountNumber: number },
    ): Promise<ScraperUploadResult> {
      return request(
        UPLOAD_POALIM_SECURITIES,
        poalimSecuritiesInfoVars(payload, bankAccount),
        'uploadPoalimSecurities',
      );
    },

    async uploadPoalimSecuritiesTransactions(
      payload: PoalimSecuritiesTransactionsPayload,
      bankAccount: { bankNumber: number; branchNumber: number; accountNumber: number },
    ): Promise<ScraperUploadResult> {
      return request(
        UPLOAD_POALIM_SECURITIES_TRANSACTIONS,
        poalimSecuritiesTransactionsVars(payload, bankAccount),
        'uploadPoalimSecuritiesTransactions',
      );
    },

    async uploadIsracard(payloads: IsracardCardsTransactionsList[]): Promise<ScraperUploadResult> {
      return request(UPLOAD_ISRACARD, isracardVars(payloads), 'uploadIsracardTransactions');
    },

    async uploadAmex(payloads: IsracardCardsTransactionsList[]): Promise<ScraperUploadResult> {
      return request(UPLOAD_AMEX, amexVars(payloads), 'uploadAmexTransactions');
    },

    async uploadCal(payload: CalPayload): Promise<ScraperUploadResult> {
      return request(UPLOAD_CAL, calVars(payload), 'uploadCalTransactions');
    },

    async uploadDiscount(payload: DiscountPayload): Promise<ScraperUploadResult> {
      return request(UPLOAD_DISCOUNT, discountVars(payload), 'uploadDiscountTransactions');
    },

    async uploadMax(payload: MaxPayload): Promise<ScraperUploadResult> {
      return request(UPLOAD_MAX, maxVars(payload), 'uploadMaxTransactions');
    },

    async uploadCurrencyRates(payload: CurrencyRatesPayload): Promise<ScraperUploadResult> {
      return request(UPLOAD_CURRENCY_RATES, currencyRatesVars(payload), 'uploadCurrencyRates');
    },

    async uploadOtsarIls(ilsData: OtsarHahayalIlsData[]): Promise<ScraperUploadResult> {
      return request(UPLOAD_OTSAR_ILS, otsarIlsVars(ilsData), 'uploadOtsarHahayalIlsTransactions');
    },

    async uploadOtsarForeign(foreignData: ForeignAccountData[]): Promise<ScraperUploadResult> {
      return request(
        UPLOAD_OTSAR_FOREIGN,
        otsarForeignVars(foreignData),
        'uploadOtsarHahayalForeignTransactions',
      );
    },

    async uploadOtsarCreditCard(
      creditCardData: OtsarHahayalCreditCardData[],
    ): Promise<ScraperUploadResult> {
      return request(
        UPLOAD_OTSAR_CREDITCARD,
        otsarCreditCardVars(creditCardData),
        'uploadOtsarHahayalCreditCardTransactions',
      );
    },
  };
}

export type UploadClient = ReturnType<typeof createUploadClient>;
