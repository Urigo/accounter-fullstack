import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { GraphQLError } from 'graphql';
import type { _DOLLAR_defs_Document } from '@accounter/green-invoice-graphql';
import type { BillingCycle, ResolversTypes } from '../../../__generated__/types.js';
import { Currency, DocumentType } from '../../../shared/enums.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { GreenInvoiceClientProvider } from '../../app-providers/green-invoice-client.js';
import {
  getChargeBusinesses,
  getChargeDocumentsMeta,
} from '../../charges/helpers/common.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import {
  getProductName,
  getSubscriptionPlanName,
  normalizeProduct,
  normalizeSubscriptionPlan,
} from '../../contracts/helpers/contracts.helper.js';
import { ContractsProvider } from '../../contracts/providers/contracts.provider.js';
import { IGetContractsByIdsResult } from '../../contracts/types.js';
import { validateClientIntegrations } from '../../financial-entities/helpers/clients.helper.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { ClientsProvider } from '../../financial-entities/providers/clients.provider.js';
import {
  convertDocumentInputIntoGreenInvoiceInput,
  getDocumentNameFromGreenInvoiceType,
  normalizeGreenInvoiceDocumentType,
} from '../../green-invoice/helpers/green-invoice.helper.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { getDocumentNameFromType } from '../helpers/common.helper.js';
import {
  convertContractToDraft,
  deduceVatTypeFromBusiness,
  executeDocumentIssue,
  filterAndHandleSwiftTransactions,
  getDocumentDateOutOfTransactions,
  getIncomeRecordsFromDocuments,
  getLinkedDocumentsAttributes,
  getPaymentsFromTransactions,
  getTypeFromDocumentsAndTransactions,
} from '../helpers/issue-document.helper.js';
import { DocumentsProvider } from '../providers/documents.provider.js';
import { IssuedDocumentsProvider } from '../providers/issued-documents.provider.js';
import type { DocumentsModule, IGetIssuedDocumentsByIdsResult } from '../types.js';
import { normalizeDocumentType } from './common.js';

export const documentsIssuingResolvers: DocumentsModule.Resolvers = {
  Query: {
    newDocumentDraftByCharge: async (
      _,
      { chargeId },
      {
        injector,
        adminContext: {
          defaultCryptoConversionFiatCurrency,
          financialAccounts: { swiftBusinessId },
          locality,
        },
      },
    ) => {
      if (!chargeId) {
        throw new GraphQLError('Charge ID is required to fetch document draft');
      }

      const chargePromise = injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
      const documentsPromise = injector
        .get(DocumentsProvider)
        .getDocumentsByChargeIdLoader.load(chargeId);
      const transactionsPromise = injector
        .get(TransactionsProvider)
        .transactionsByChargeIDLoader.load(chargeId)
        .then(res => filterAndHandleSwiftTransactions(res, swiftBusinessId));

      const [charge, documents, transactions, { documentsCurrency }, { mainBusinessId }] =
        await Promise.all([
          chargePromise,
          documentsPromise,
          transactionsPromise,
          getChargeDocumentsMeta(chargeId, injector),
          getChargeBusinesses(chargeId, injector),
        ]);

      if (!charge) {
        throw new GraphQLError(`Charge with ID "${chargeId}" not found`);
      }

      const clientPromise = mainBusinessId
        ? injector.get(ClientsProvider).getClientByIdLoader.load(mainBusinessId)
        : Promise.resolve(undefined);

      const openIssuedDocumentsPromise = injector
        .get(IssuedDocumentsProvider)
        .getIssuedDocumentsByIdLoader.loadMany(documents.map(d => d.id))
        .then(
          res =>
            res.filter(r => {
              if (!r) return false;

              if (r instanceof Error) {
                console.error('Failed to fetch issued document', r);
                return false;
              }

              if (r.status !== 'OPEN') {
                return false;
              }

              return true;
            }) as IGetIssuedDocumentsByIdsResult[],
        );

      const paymentPromise = getPaymentsFromTransactions(injector, transactions);

      const vatTypePromise = deduceVatTypeFromBusiness(injector, locality, mainBusinessId);

      const [client, openIssuedDocuments, payment, vatType] = await Promise.all([
        clientPromise,
        openIssuedDocumentsPromise,
        paymentPromise,
        vatTypePromise,
      ]);

      const greenInvoiceDocuments = await Promise.all(
        openIssuedDocuments.map(doc =>
          injector
            .get(GreenInvoiceClientProvider)
            .documentLoader.load(doc.external_id)
            .then(res => {
              if (!res) {
                console.error('Failed to fetch document from Green Invoice', doc.external_id);
                return null;
              }
              return res;
            }),
        ),
      ).then(res => res.filter(Boolean) as _DOLLAR_defs_Document[]);

      const greenInvoiceClientId = validateClientIntegrations(
        client?.integrations ?? {},
      ).greenInvoiceId;
      if (!greenInvoiceClientId) {
        throw new GraphQLError(
          `Green invoice integration missing for business ID="${mainBusinessId}"`,
        );
      }

      const income = getIncomeRecordsFromDocuments(
        openIssuedDocuments.map(
          doc => greenInvoiceDocuments.find(gd => gd.id === doc.external_id)!,
        ),
      );

      if (income.length === 0 && transactions.length > 0) {
        income.push(
          ...transactions.map(transaction => ({
            description: transaction.source_description ?? '',
            quantity: 1,
            price: Number(transaction.amount),
            currency: transaction.currency as Currency,
            currencyRate: undefined,
            vatType,
          })),
        );
      }

      const type = getTypeFromDocumentsAndTransactions(
        greenInvoiceDocuments.map(doc => ({ type: normalizeGreenInvoiceDocumentType(doc.type) })),
        transactions,
      );

      const linkedDocsAttributes = getLinkedDocumentsAttributes(
        openIssuedDocuments,
        type === DocumentType.CreditInvoice,
      );

      let remarks = charge.user_description;
      if (greenInvoiceDocuments.length) {
        remarks = greenInvoiceDocuments.map(doc => doc.remarks).join(', ');
        switch (type) {
          case DocumentType.Receipt:
          case DocumentType.InvoiceReceipt:
            remarks = `${getDocumentNameFromType(type)} for ${greenInvoiceDocuments.map(doc => `${getDocumentNameFromGreenInvoiceType(doc.type)} ${doc.number}`).join(', ')}`;
            break;
        }
      } else if (client?.remark) {
        remarks = client.remark;
      }

      const documentDate = getDocumentDateOutOfTransactions(transactions);

      const transactionsCurrencies = Array.from(new Set(transactions.map(t => t.currency)));
      const transactionsCurrency =
        transactionsCurrencies.length === 1 ? transactionsCurrencies[0] : undefined;

      const draft: ResolversTypes['DocumentDraft'] = {
        remarks,
        // description: ____,
        // footer: ____,
        type,
        date: documentDate,
        dueDate: dateToTimelessDateString(endOfMonth(new Date())),
        language: 'ENGLISH',
        currency: (transactionsCurrency ||
          documentsCurrency ||
          defaultCryptoConversionFiatCurrency) as Currency,
        vatType,
        rounding: false,
        signed: true,
        client,
        income,
        payment,
        // linkedPaymentId: ____,
        // maxPayments: _____,
        // discount: _____,
        ...linkedDocsAttributes,
      };
      return draft;
    },
    newDocumentDraftByDocument: async (
      _,
      { documentId },
      {
        injector,
        adminContext: {
          defaultCryptoConversionFiatCurrency,
          financialAccounts: { swiftBusinessId },
          locality,
        },
      },
    ) => {
      if (!documentId) {
        throw new GraphQLError('Document ID is required to fetch document draft');
      }

      const document = await injector
        .get(DocumentsProvider)
        .getDocumentsByIdLoader.load(documentId);

      if (!document) {
        throw new GraphQLError(`Document with ID "${documentId}" not found`);
      }

      const chargePromise = document.charge_id
        ? injector.get(ChargesProvider).getChargeByIdLoader.load(document.charge_id)
        : Promise.resolve(undefined);
      const transactionsPromise = document.charge_id
        ? injector
            .get(TransactionsProvider)
            .transactionsByChargeIDLoader.load(document.charge_id)
            .then(res => filterAndHandleSwiftTransactions(res, swiftBusinessId))
        : Promise.resolve(undefined);
      const mainBusinessIdPromise = document.charge_id
        ? getChargeBusinesses(document.charge_id, injector).then(res => res.mainBusinessId)
        : Promise.resolve(undefined);

      const [charge, transactions, mainBusinessId] = await Promise.all([
        chargePromise,
        transactionsPromise,
        mainBusinessIdPromise,
      ]);

      if (!charge) {
        throw new GraphQLError(`Charge with ID "${document.charge_id}" not found`);
      }

      const clientPromise = mainBusinessId
        ? injector.get(ClientsProvider).getClientByIdLoader.load(mainBusinessId)
        : Promise.resolve(undefined);

      const openIssuedDocumentPromise = injector
        .get(IssuedDocumentsProvider)
        .getIssuedDocumentsByIdLoader.load(document.id);

      const vatTypePromise = deduceVatTypeFromBusiness(injector, locality, mainBusinessId);

      const [client, openIssuedDocument, vatType] = await Promise.all([
        clientPromise,
        openIssuedDocumentPromise,
        vatTypePromise,
      ]);

      if (!openIssuedDocument) {
        throw new GraphQLError(
          `Document with ID "${document.id}" doesn't seem like a document we issued`,
        );
      }

      if (openIssuedDocument.status !== 'OPEN') {
        throw new GraphQLError(`Document with ID "${document.id}" is closed`);
      }

      const greenInvoiceDocumentPromise: Promise<_DOLLAR_defs_Document | null> = injector
        .get(GreenInvoiceClientProvider)
        .documentLoader.load(openIssuedDocument.external_id)
        .then(res => {
          if (!res) {
            console.error(
              'Failed to fetch document from Green Invoice',
              openIssuedDocument.external_id,
            );
            return null;
          }
          return res;
        });

      const paymentPromise = getPaymentsFromTransactions(injector, transactions ?? []);

      const greenInvoiceClientId = validateClientIntegrations(
        client?.integrations ?? {},
      ).greenInvoiceId;
      if (!greenInvoiceClientId) {
        throw new GraphQLError(
          `Green invoice integration missing for business ID="${mainBusinessId}"`,
        );
      }

      const [greenInvoiceDocument, payment, { documentsCurrency }] = await Promise.all([
        greenInvoiceDocumentPromise,
        paymentPromise,
        getChargeDocumentsMeta(charge.id, injector),
      ]);

      if (!greenInvoiceDocument) {
        throw new GraphQLError(
          `Document with ID "${document.id}" doesn't have a Green Invoice matching document`,
        );
      }

      const income = getIncomeRecordsFromDocuments([greenInvoiceDocument]);

      const type = getTypeFromDocumentsAndTransactions(
        [{ type: normalizeDocumentType(document.type) }],
        transactions ?? [],
      );

      const linkedDocsAttributes = getLinkedDocumentsAttributes(
        [openIssuedDocument],
        type === DocumentType.CreditInvoice,
      );

      let remarks = greenInvoiceDocument.remarks;
      switch (type) {
        case DocumentType.Receipt:
        case DocumentType.InvoiceReceipt:
          remarks = `${getDocumentNameFromType(type)} for ${getDocumentNameFromGreenInvoiceType(greenInvoiceDocument.type)} ${greenInvoiceDocument.number}`;
          break;
      }

      if (!remarks && client?.remark) {
        remarks = client.remark;
      }

      const documentDate = getDocumentDateOutOfTransactions(transactions ?? []);

      const draft: ResolversTypes['DocumentDraft'] = {
        remarks,
        // description: ____,
        // footer: ____,
        type,
        date: documentDate,
        dueDate: dateToTimelessDateString(endOfMonth(new Date())),
        language: 'ENGLISH',
        currency: (documentsCurrency || defaultCryptoConversionFiatCurrency) as Currency,
        vatType,
        rounding: false,
        signed: true,
        client,
        income,
        payment,
        // linkedPaymentId: ____,
        // maxPayments: _____,
        // discount: _____,
        ...linkedDocsAttributes,
      };
      return draft;
    },
    periodicalDocumentDrafts: async (_, { issueMonth }, { injector }) => {
      const openContracts = await injector.get(ContractsProvider).getAllOpenContracts();
      const monthlyBillingCycle: BillingCycle = 'MONTHLY';
      const monthlyContracts = openContracts.filter(
        contract => contract.billing_cycle.toLocaleUpperCase() === monthlyBillingCycle,
      );
      const drafts = await Promise.all(
        monthlyContracts.map(async contract =>
          convertContractToDraft(contract, injector, issueMonth),
        ),
      );

      return drafts;
    },
    periodicalDocumentDraftsByContracts: async (_, { issueMonth, contractIds }, { injector }) => {
      const contracts = await injector
        .get(ContractsProvider)
        .getContractsByIdLoader.loadMany(contractIds)
        .then(res => res.filter(c => !!c && !(c instanceof Error)) as IGetContractsByIdsResult[]);

      const drafts = await Promise.all(
        contracts.map(async contract => convertContractToDraft(contract, injector, issueMonth)),
      );

      return drafts;
    },
    clientMonthlyChargeDraft: async (_, { clientId, issueMonth }, { injector }) => {
      const clientContracts = await injector
        .get(ContractsProvider)
        .getContractsByClientIdLoader.load(clientId);
      const contracts = clientContracts.filter(clientContract => clientContract.is_active);

      if (contracts.length === 0) {
        throw new GraphQLError(`No active contracts found for client ID="${clientId}"`);
      }
      if (contracts.length > 1) {
        throw new GraphQLError(
          `Multiple active contracts found for client ID="${clientId}", cannot deduce which one to use`,
        );
      }

      const contract = contracts[0];

      if (!contract) {
        throw new GraphQLError(`Contract not found for client ID="${clientId}"`);
      }

      const businessPromise = injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(contract.client_id);
      const clientPromise = injector
        .get(ClientsProvider)
        .getClientByIdLoader.load(contract.client_id);
      const [business, client] = await Promise.all([businessPromise, clientPromise]);

      if (!business) {
        throw new GraphQLError(`Business ID="${contract.client_id}" not found`);
      }

      if (!client) {
        throw new GraphQLError(`Client not found for business ID="${contract.client_id}"`);
      }

      const greenInvoiceId = validateClientIntegrations(client.integrations)?.greenInvoiceId;

      if (!greenInvoiceId) {
        throw new GraphQLError(
          `Green invoice match not found for business ID="${contract.client_id}"`,
        );
      }

      const today = issueMonth ? addMonths(new Date(issueMonth), 1) : new Date();
      const monthStart = dateToTimelessDateString(startOfMonth(today));
      const monthEnd = dateToTimelessDateString(endOfMonth(today));
      const year = today.getFullYear() + (today.getMonth() === 0 ? -1 : 0);
      const month = format(subMonths(today, 1), 'MMMM');

      const vatType = await deduceVatTypeFromBusiness(
        injector,
        business.country,
        contract.client_id,
      );

      const draft: ResolversTypes['DocumentDraft'] = {
        remarks: `${contract.purchase_orders[0] ? `PO: ${contract.purchase_orders[0]}${contract.remarks ? ', ' : ''}` : ''}${contract.remarks ?? ''}`,
        description: `${getProductName(normalizeProduct(contract.product ?? '')!)} ${getSubscriptionPlanName(normalizeSubscriptionPlan(contract.plan ?? '')!)} - ${month} ${year}`,
        type: normalizeDocumentType(contract.document_type),
        date: monthStart,
        dueDate: monthEnd,
        language: 'ENGLISH',
        currency: contract.currency as Currency,
        vatType,
        rounding: false,
        signed: true,
        client,
        income: [
          {
            description: `${getProductName(normalizeProduct(contract.product ?? '')!)} ${getSubscriptionPlanName(normalizeSubscriptionPlan(contract.plan ?? '')!)} - ${month} ${year}`,
            quantity: 1,
            price: contract.amount,
            currency: contract.currency as Currency,
            vatType,
          },
        ],
      };

      return draft;
    },
  },
  Mutation: {
    issueGreenInvoiceDocuments: async (
      _,
      { generateDocumentsInfo },
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      const errors: string[] = [];

      await Promise.all(
        generateDocumentsInfo.map(document => {
          executeDocumentIssue(
            injector,
            defaultAdminBusinessId,
            document,
            undefined,
            true,
            undefined,
            true,
          ).catch(e => {
            console.error(e);
            errors.push(`${document.client?.name ?? document.client?.id}: ${e.message}`);
          });
        }),
      );

      return {
        success: true,
        errors,
      };
    },
    issueGreenInvoiceDocument: async (
      _,
      { input: initialInput, emailContent, attachment, chargeId, sendEmail = false },
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      return executeDocumentIssue(
        injector,
        defaultAdminBusinessId,
        initialInput,
        emailContent ?? undefined,
        attachment ?? undefined,
        chargeId ?? undefined,
        sendEmail ?? false,
      );
    },
    previewDocument: async (_, { input: initialInput }, { injector }) => {
      const input = await convertDocumentInputIntoGreenInvoiceInput(initialInput, injector);
      const document = await injector.get(GreenInvoiceClientProvider).previewDocuments({ input });

      if (!document) {
        throw new GraphQLError('Failed to generate document preview');
      }

      if ('errorMessage' in document) {
        console.error('Failed to generate document preview', document);
        throw new GraphQLError(
          `Failed to generate document preview, Green Invoice returned: ${document.errorMessage}`,
        );
      }

      if ('file' in document && document.file) {
        return document.file;
      }

      console.error('Document preview does not contain a file', document);
      throw new GraphQLError('Document preview does not contain a file');
    },
  },
};
