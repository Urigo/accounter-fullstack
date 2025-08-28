import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { GraphQLError } from 'graphql';
import type { Document } from '@accounter/green-invoice-graphql';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { ContractsProvider } from '@modules/contracts/providers/contracts.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { IssuedDocumentsProvider } from '@modules/documents/providers/issued-documents.provider.js';
import { normalizeDocumentType } from '@modules/documents/resolvers/common.js';
import type {
  IGetAllIssuedDocumentsResult,
  IGetIssuedDocumentsByIdsResult,
  IInsertDocumentsResult,
  IUpdateIssuedDocumentParams,
} from '@modules/documents/types.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { ClientsProvider } from '@modules/financial-entities/providers/clients.provider.js';
import {
  convertDocumentInputIntoGreenInvoiceInput,
  convertGreenInvoiceDocumentToLocalDocumentInfo,
  getGreenInvoiceDocumentNameFromType,
  getGreenInvoiceDocuments,
  getLinkedDocuments,
  greenInvoiceToDocumentStatus,
  insertNewDocumentFromGreenInvoice,
} from '@modules/green-invoice/helpers/green-invoice.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { Currency, DocumentType } from '@shared/enums';
import { NewDocumentInfo } from '@shared/gql-types';
import { dateToTimelessDateString } from '@shared/helpers';
import {
  deduceVatTypeFromBusiness,
  executeDocumentIssue,
  filterAndHandleSwiftTransactions,
  getClientFromGreenInvoiceClient,
  getDocumentDateOutOfTransactions,
  getIncomeFromDocuments,
  getLinkedDocumentsAttributes,
  getPaymentsFromTransactions,
  getTypeFromDocumentsAndTransactions,
} from '../helpers/issue-document.helper.js';
import type { GreenInvoiceModule } from '../types.js';

export const greenInvoiceResolvers: GreenInvoiceModule.Resolvers = {
  Query: {
    newDocumentInfoDraftByCharge: async (
      _,
      { chargeId },
      {
        injector,
        adminContext: {
          defaultCryptoConversionFiatCurrency,
          financialAccounts: { swiftBusinessId },
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

      const [charge, documents, transactions] = await Promise.all([
        chargePromise,
        documentsPromise,
        transactionsPromise,
      ]);

      if (!charge) {
        throw new GraphQLError(`Charge with ID "${chargeId}" not found`);
      }

      const businessMatchPromise = charge.business_id
        ? injector.get(ClientsProvider).getClientByIdLoader.load(charge.business_id)
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

      const clientPromise = charge.business_id
        ? getClientFromGreenInvoiceClient(injector, charge.business_id)
        : Promise.resolve(undefined);

      const paymentPromise = getPaymentsFromTransactions(injector, transactions);

      const vatTypePromise = deduceVatTypeFromBusiness(injector, charge.business_id);

      const [businessMatch, openIssuedDocuments, client, payment, vatType] = await Promise.all([
        businessMatchPromise,
        openIssuedDocumentsPromise,
        clientPromise,
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
      ).then(res => res.filter(Boolean) as Document[]);

      const income = getIncomeFromDocuments(
        openIssuedDocuments.map(doc => ({
          document: documents.find(d => d.id === doc.id)!,
          issuedDocument: doc,
          greenInvoiceDocument: greenInvoiceDocuments.find(gd => gd.id === doc.external_id)!,
        })),
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

      const type = getTypeFromDocumentsAndTransactions(greenInvoiceDocuments, transactions);

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
            remarks = `${getGreenInvoiceDocumentNameFromType(type)} for ${greenInvoiceDocuments.map(doc => `${getGreenInvoiceDocumentNameFromType(doc.type)} ${doc.number}`).join(', ')}`;
            break;
        }
      } else if (businessMatch?.remark) {
        remarks = businessMatch.remark;
      }

      const documentDate = getDocumentDateOutOfTransactions(transactions);

      return {
        remarks,
        // description: ____,
        // footer: ____,
        type,
        date: documentDate,
        dueDate: dateToTimelessDateString(endOfMonth(new Date())),
        lang: 'ENGLISH',
        currency: (charge.transactions_currency ||
          charge.documents_currency ||
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
    },
    newDocumentInfoDraftByDocument: async (
      _,
      { documentId },
      {
        injector,
        adminContext: {
          defaultCryptoConversionFiatCurrency,
          financialAccounts: { swiftBusinessId },
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

      const [charge, transactions] = await Promise.all([chargePromise, transactionsPromise]);

      if (!charge) {
        throw new GraphQLError(`Charge with ID "${document.charge_id}" not found`);
      }

      const businessMatchPromise = charge.business_id
        ? injector.get(ClientsProvider).getClientByIdLoader.load(charge.business_id)
        : Promise.resolve(undefined);

      const openIssuedDocumentPromise = injector
        .get(IssuedDocumentsProvider)
        .getIssuedDocumentsByIdLoader.load(document.id);

      const vatTypePromise = deduceVatTypeFromBusiness(injector, charge.business_id);

      const [businessMatch, openIssuedDocument, vatType] = await Promise.all([
        businessMatchPromise,
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

      const greenInvoiceDocumentPromise: Promise<Document | null> = injector
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

      const clientPromise = charge.business_id
        ? getClientFromGreenInvoiceClient(injector, charge.business_id)
        : Promise.resolve(undefined);

      const [greenInvoiceDocument, payment, client] = await Promise.all([
        greenInvoiceDocumentPromise,
        paymentPromise,
        clientPromise,
      ]);

      if (!greenInvoiceDocument) {
        throw new GraphQLError(
          `Document with ID "${document.id}" doesn't have a Green Invoice matching document`,
        );
      }

      const income = getIncomeFromDocuments([
        {
          document,
          issuedDocument: openIssuedDocument,
          greenInvoiceDocument,
        },
      ]);

      const type = getTypeFromDocumentsAndTransactions([greenInvoiceDocument], transactions ?? []);

      const linkedDocsAttributes = getLinkedDocumentsAttributes(
        [openIssuedDocument],
        type === DocumentType.CreditInvoice,
      );

      let remarks = greenInvoiceDocument.remarks;
      switch (type) {
        case DocumentType.Receipt:
        case DocumentType.InvoiceReceipt:
          remarks = `${getGreenInvoiceDocumentNameFromType(type)} for ${getGreenInvoiceDocumentNameFromType(greenInvoiceDocument.type)} ${greenInvoiceDocument.number}`;
          break;
      }

      if (!remarks && businessMatch?.remark) {
        remarks = businessMatch.remark;
      }

      const documentDate = getDocumentDateOutOfTransactions(transactions ?? []);

      return {
        remarks,
        // description: ____,
        // footer: ____,
        type,
        date: documentDate,
        dueDate: dateToTimelessDateString(endOfMonth(new Date())),
        lang: 'ENGLISH',
        currency: (charge.documents_currency || defaultCryptoConversionFiatCurrency) as Currency,
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
    },
    clientMonthlyChargesDrafts: async (_, { issueMonth }, { injector }) => {
      const openContracts = await injector.get(ContractsProvider).getAllOpenContracts();
      const monthlyContracts = openContracts.filter(
        contract => contract.billing_cycle === 'monthly',
      );
      const drafts = await Promise.all(
        monthlyContracts.map(async contract => {
          const businessPromise = injector
            .get(BusinessesProvider)
            .getBusinessByIdLoader.load(contract.client_id);
          const clientPromise = injector
            .get(ClientsProvider)
            .getClientByIdLoader.load(contract.client_id);
          const greenInvoiceClientPromise = getClientFromGreenInvoiceClient(
            injector,
            contract.client_id,
          );
          const [business, client, greenInvoiceClient] = await Promise.all([
            businessPromise,
            clientPromise,
            greenInvoiceClientPromise,
          ]);

          if (!business) {
            throw new GraphQLError(`Business ID="${contract.client_id}" not found`);
          }

          if (!client) {
            throw new GraphQLError(`Client not found for business ID="${contract.client_id}"`);
          }

          if (!greenInvoiceClient) {
            throw new GraphQLError(
              `Green invoice match not found for business ID="${contract.client_id}"`,
            );
          }

          const today = issueMonth ? addMonths(new Date(issueMonth), 1) : new Date();
          const monthStart = dateToTimelessDateString(startOfMonth(today));
          const monthEnd = dateToTimelessDateString(endOfMonth(today));
          const year = today.getFullYear() + (today.getMonth() === 0 ? -1 : 0);
          const month = format(subMonths(today, 1), 'MMMM');

          const documentInput: NewDocumentInfo = {
            remarks: `${contract.purchase_order ? `PO: ${contract.purchase_order}${contract.remarks ? ', ' : ''}` : ''}${contract.remarks ?? ''}`,
            description: `GraphQL Hive Enterprise License - ${month} ${year}`,
            type: normalizeDocumentType(contract.document_type),
            date: monthStart,
            dueDate: monthEnd,
            lang: 'ENGLISH',
            currency: contract.currency as Currency,
            vatType: 'EXEMPT',
            rounding: false,
            signed: true,
            client: {
              ...greenInvoiceClient,
              emails: [...((client.emails?.filter(Boolean) as string[]) ?? [])],
            },
            income: [
              {
                description: `GraphQL Hive Enterprise License - ${month} ${year}`,
                quantity: 1,
                price: contract.amount,
                currency: contract.currency as Currency,
                vatType: 'EXEMPT',
              },
            ],
          };

          return documentInput;
        }),
      );

      return drafts;
    },
    clientMonthlyChargeDraft: async (_, { clientId, issueMonth }, { injector }) => {
      const openContracts = await injector.get(ContractsProvider).getAllOpenContracts();
      const contract = openContracts.find(openContract => openContract.client_id === clientId);

      if (!contract) {
        throw new GraphQLError(`Contract not found for client ID="${clientId}"`);
      }

      const businessPromise = injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(contract.client_id);
      const clientPromise = injector
        .get(ClientsProvider)
        .getClientByIdLoader.load(contract.client_id);
      const greenInvoiceClientPromise = getClientFromGreenInvoiceClient(
        injector,
        contract.client_id,
      );
      const [business, client, greenInvoiceClient] = await Promise.all([
        businessPromise,
        clientPromise,
        greenInvoiceClientPromise,
      ]);

      if (!business) {
        throw new GraphQLError(`Business ID="${contract.client_id}" not found`);
      }

      if (!client) {
        throw new GraphQLError(`Client not found for business ID="${contract.client_id}"`);
      }

      if (!greenInvoiceClient) {
        throw new GraphQLError(
          `Green invoice match not found for business ID="${contract.client_id}"`,
        );
      }

      const today = issueMonth ? addMonths(new Date(issueMonth), 1) : new Date();
      const monthStart = dateToTimelessDateString(startOfMonth(today));
      const monthEnd = dateToTimelessDateString(endOfMonth(today));
      const year = today.getFullYear() + (today.getMonth() === 0 ? -1 : 0);
      const month = format(subMonths(today, 1), 'MMMM');

      const draft: NewDocumentInfo = {
        remarks: `${contract.purchase_order ? `PO: ${contract.purchase_order}${contract.remarks ? ', ' : ''}` : ''}${contract.remarks ?? ''}`,
        description: `GraphQL Hive Enterprise License - ${month} ${year}`,
        type: normalizeDocumentType(contract.document_type),
        date: monthStart,
        dueDate: monthEnd,
        lang: 'ENGLISH',
        currency: contract.currency as Currency,
        vatType: 'EXEMPT',
        rounding: false,
        signed: true,
        client: {
          ...greenInvoiceClient,
          emails: [...((client.emails?.filter(Boolean) as string[]) ?? [])],
        },
        income: [
          {
            description: `GraphQL Hive Enterprise License - ${month} ${year}`,
            quantity: 1,
            price: contract.amount,
            currency: contract.currency as Currency,
            vatType: 'EXEMPT',
          },
        ],
      };

      return draft;
    },
  },
  Mutation: {
    fetchIncomeDocuments: async (
      _,
      { ownerId: inputOwnerId, singlePageLimit = true },
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      const ownerId = inputOwnerId ?? defaultAdminBusinessId;
      const greenInvoiceDocuments = await getGreenInvoiceDocuments(injector, !singlePageLimit);

      const issuedDocuments = await injector.get(IssuedDocumentsProvider).getAllIssuedDocuments();

      // check for new or updated documents
      const newDocuments: Document[] = [];
      const documentToUpdate: {
        localDoc: IGetAllIssuedDocumentsResult;
        externalDoc: Document;
      }[] = [];
      await Promise.all(
        greenInvoiceDocuments.map(async item => {
          const existingDocs = issuedDocuments.filter(doc => doc.external_id === item.id);

          // Throw an error if more than one document found with the same external ID
          if (existingDocs.length > 1) {
            throw new GraphQLError(
              `Found multiple issued documents with the same external ID: ${item.id}`,
            );
          }

          // If no existing document found, add it to the new documents list
          if (existingDocs.length === 0) {
            newDocuments.push(item);
            return;
          }

          // For existing document => check for updates
          const existingDoc = existingDocs[0];

          documentToUpdate.push({
            localDoc: existingDoc,
            externalDoc: item,
          });
        }),
      );

      const addedDocs: IInsertDocumentsResult[] = [];

      // run insertions first, to avoid broken linked documents
      await Promise.all(
        newDocuments.map(async greenInvoiceDoc => {
          const newDocument = await insertNewDocumentFromGreenInvoice(
            injector,
            greenInvoiceDoc,
            ownerId,
          );

          if (newDocument) {
            addedDocs.push(newDocument);
          }
        }),
      );

      // Check for updates
      await Promise.all(
        documentToUpdate.map(async ({ localDoc, externalDoc }) => {
          const docToUpdate: Partial<IUpdateIssuedDocumentParams> = {};
          // check if the document status has changed
          const latestStatus = greenInvoiceToDocumentStatus(externalDoc.status);
          if (latestStatus !== localDoc.status) {
            docToUpdate.status = latestStatus;
          }

          // check if the linked documents have changed
          const linkedDocuments = await getLinkedDocuments(injector, externalDoc.id).catch(e => {
            console.error('Failed to fetch linked documents', e);
            return null;
          });
          if (
            linkedDocuments?.length &&
            (!localDoc.linked_document_ids ||
              localDoc.linked_document_ids.length !== linkedDocuments.length ||
              localDoc.linked_document_ids?.some(id => !linkedDocuments.includes(id)))
          ) {
            docToUpdate.linkedDocumentIds = linkedDocuments;
          }

          // if has attributes to update, add to the update list
          if (Object.keys(docToUpdate).length > 0) {
            await injector
              .get(IssuedDocumentsProvider)
              .updateIssuedDocument({
                documentId: localDoc.id,
                ...docToUpdate,
              })
              .catch(e => {
                console.error('Failed to update issued document linked documents', e);
                throw new GraphQLError(
                  `Failed to update issued document linked documents for Green Invoice ID: ${docToUpdate.documentId}`,
                );
              });
          }
        }),
      );

      return addedDocs;
    },
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
    previewGreenInvoiceDocument: async (_, { input: initialInput }, { injector }) => {
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
  },
  IssuedDocumentInfo: {
    originalDocument: async (info, _, { injector }) => {
      if (!info?.externalId) {
        throw new GraphQLError('External ID is required to fetch original document');
      }
      try {
        const document = await injector
          .get(GreenInvoiceClientProvider)
          .documentLoader.load(info.externalId);
        if (!document) {
          throw new GraphQLError('Original document not found');
        }
        return convertGreenInvoiceDocumentToLocalDocumentInfo(document);
      } catch (error) {
        console.error('Error fetching original document:', error);
        throw new GraphQLError('Error fetching original document');
      }
    },
  },
};
