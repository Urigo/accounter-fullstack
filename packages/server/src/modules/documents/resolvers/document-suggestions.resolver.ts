import {
  getChargeDocumentsMeta,
  getChargeTransactionsMeta,
} from '@modules/charges/helpers/common.helper.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
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
    const [
      charge,
      { transactionsAmount, transactionsCurrency },
      { documentsAmount, documentsCurrency },
    ] = await Promise.all([
      injector.get(ChargesProvider).getChargeByIdLoader.load(RawDocument.charge_id),
      getChargeTransactionsMeta(RawDocument.charge_id, injector),
      getChargeDocumentsMeta(RawDocument.charge_id, injector),
    ]);
    if (charge?.business_id) {
      response.counterpartyId = charge.business_id;
    }
    if (charge?.owner_id) {
      response.ownerId = charge.owner_id;
    }
    if (transactionsAmount) {
      response.isIncome = transactionsAmount > 0;
    }
    if (transactionsAmount && transactionsCurrency) {
      // use transactions info, if exists
      response.amount = {
        amount: transactionsAmount,
        currency: formatCurrency(transactionsCurrency),
      };
    } else if (documentsAmount && documentsCurrency) {
      // Use parallel documents (if exists) as documentsAmount is based on invoices OR receipts
      response.amount = {
        amount: documentsAmount,
        currency: documentsCurrency,
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
