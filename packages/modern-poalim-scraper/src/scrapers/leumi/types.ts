import type { z } from 'zod';
import type { depositsResponseSchema } from './deposits.js';
import type { ForeignAccountActivity, ForeignAccountOption } from './foreign-transactions.js';
import type {
  allAccountsResponseSchema,
  creditCardDetailsResponseSchema,
  creditCardLinesResponseSchema,
  creditCardNisTransactionSchema,
  creditCardsInfoResponseSchema,
  getAccountsResponseSchema,
  ilsTransactionSchema,
  ilsTransactionsResponseSchema,
  marketProductDetailsResponseSchema,
  mortgageDataResponseSchema,
  mortgageDetailsResponseSchema,
  mortgageLoanInfoResponseSchema,
  savingCdDataResponseSchema,
  summaryDataResponseSchema,
  tradeConfigResponseSchema,
} from './schemas.js';

export type LeumiAccountsResponse = z.infer<typeof getAccountsResponseSchema>;
export type LeumiAllAccountsResponse = z.infer<typeof allAccountsResponseSchema>;
export type LeumiSummaryResponse = z.infer<typeof summaryDataResponseSchema>;
export type LeumiIlsTransaction = z.infer<typeof ilsTransactionSchema>;
export type LeumiIlsTransactionsResponse = z.infer<typeof ilsTransactionsResponseSchema>;
export type LeumiCreditCardsResponse = z.infer<typeof creditCardsInfoResponseSchema>;
export type LeumiCreditCardDetailsResponse = z.infer<typeof creditCardDetailsResponseSchema>;
export type LeumiCreditCardTransaction = z.infer<typeof creditCardNisTransactionSchema>;
export type LeumiCreditCardLinesResponse = z.infer<typeof creditCardLinesResponseSchema>;
export type LeumiMortgagesResponse = z.infer<typeof mortgageDetailsResponseSchema>;
export type LeumiMortgageTracksResponse = z.infer<typeof mortgageLoanInfoResponseSchema>;
export type LeumiMortgageBalancesResponse = z.infer<typeof mortgageDataResponseSchema>;
export type LeumiDepositsResponse = z.infer<typeof depositsResponseSchema>;
export type LeumiDepositTotalsResponse = z.infer<typeof savingCdDataResponseSchema>;
export type LeumiMoneyMarketProductsResponse = z.infer<typeof marketProductDetailsResponseSchema>;
export type LeumiSecuritiesProfileResponse = z.infer<typeof tradeConfigResponseSchema>;
export type LeumiForeignAccount = ForeignAccountOption;
export type LeumiForeignAccountActivity = ForeignAccountActivity;
