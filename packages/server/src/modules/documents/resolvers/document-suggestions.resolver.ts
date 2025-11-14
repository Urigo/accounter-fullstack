import {
  getChargeBusinesses,
  getChargeDocumentsAmounts,
  getChargeTransactionsAmounts,
} from '@modules/charges/helpers/charge-summaries.helper.js';
import { ChargesTempProvider } from '@modules/charges/providers/charges-temp.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import {
  CreditInvoiceResolvers,
  InvoiceReceiptResolvers,
  InvoiceResolvers,
  Maybe,
  ReceiptResolvers,
  Resolver,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { formatCurrency, formatFinancialAmount } from '@shared/helpers';
import type { DocumentSuggestionsProto } from '@shared/types';
import type { DocumentsModule } from '../types.js';

type Suggestion = Awaited<ResolversTypes['DocumentSuggestions']>;

const missingInfoSuggestions: Resolver<
  Maybe<Suggestion>,
  ResolversParentTypes['FinancialDocument'],
  GraphQLModules.Context
> = async (RawDocument, _, { injector }) => {
  const response: DocumentSuggestionsProto = {};
  if (RawDocument.charge_id) {
    const [charge, { mainBusiness }, { transactionsAmount, currencies }] = await Promise.all([
      injector.get(ChargesTempProvider).getChargeByIdLoader.load(RawDocument.charge_id),
      getChargeBusinesses(RawDocument.charge_id, injector),
      getChargeTransactionsAmounts(RawDocument.charge_id, injector),
    ]);
    if (mainBusiness) {
      response.counterpartyId = mainBusiness;
    }
    if (charge?.owner_id) {
      response.ownerId = charge.owner_id;
    }
    if (transactionsAmount) {
      const amount = transactionsAmount;
      if (!Number.isNaN(amount)) {
        response.isIncome = transactionsAmount > 0;
      }
    }
    if (transactionsAmount && currencies.length === 1) {
      // use transactions info, if exists
      response.amount = {
        amount: transactionsAmount,
        currency: formatCurrency(currencies[0]),
      };
      return response;
    }
    const {
      invoiceAmount,
      receiptAmount,
      currencies: documentsCurrencies,
    } = await getChargeDocumentsAmounts(RawDocument.charge_id, injector);
    if ((invoiceAmount || receiptAmount) && documentsCurrencies.length === 1) {
      // Use parallel documents (if exists) as documents_event_amount is based on invoices OR receipts
      response.amount = {
        amount: invoiceAmount || receiptAmount,
        currency: formatCurrency(documentsCurrencies[0]),
      };
    }
  }

  return response;
};

export const documentSuggestionsResolvers: DocumentsModule.Resolvers = {
  Invoice: {
    missingInfoSuggestions: missingInfoSuggestions as InvoiceResolvers['missingInfoSuggestions'],
  },
  Receipt: {
    missingInfoSuggestions: missingInfoSuggestions as ReceiptResolvers['missingInfoSuggestions'],
  },
  InvoiceReceipt: {
    missingInfoSuggestions:
      missingInfoSuggestions as InvoiceReceiptResolvers['missingInfoSuggestions'],
  },
  CreditInvoice: {
    missingInfoSuggestions:
      missingInfoSuggestions as CreditInvoiceResolvers['missingInfoSuggestions'],
  },
  Proforma: {
    missingInfoSuggestions:
      missingInfoSuggestions as InvoiceReceiptResolvers['missingInfoSuggestions'],
  },
  DocumentSuggestions: {
    counterparty: (suggestion, _, { injector }) =>
      suggestion.counterpartyId
        ? injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(suggestion.counterpartyId)
            .then(res => res ?? null)
        : null,
    owner: (suggestion, _, { injector }) =>
      suggestion.ownerId
        ? injector
            .get(BusinessesProvider)
            .getBusinessByIdLoader.load(suggestion.ownerId)
            .then(res => res ?? null)
        : null,
    amount: suggestion =>
      suggestion.amount
        ? formatFinancialAmount(suggestion.amount.amount, suggestion.amount.currency)
        : null,
    isIncome: suggestion => (suggestion.isIncome == null ? null : suggestion.isIncome),
  },
};
