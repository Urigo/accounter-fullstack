import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { GraphQLError } from 'graphql';
import type { addDocumentRequest_Input, Document } from '@accounter/green-invoice-graphql';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { IssuedDocumentsProvider } from '@modules/documents/providers/issued-documents.provider.js';
import type {
  IGetIssuedDocumentsByIdsResult,
  IInsertDocumentsResult,
  IUpdateIssuedDocumentParams,
} from '@modules/documents/types.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import {
  convertCurrencyToGreenInvoice,
  convertDocumentInputIntoGreenInvoiceInput,
  getGreenInvoiceDocumentNameFromType,
  getGreenInvoiceDocuments,
  getGreenInvoiceDocumentType,
  getLinkedDocuments,
  greenInvoiceToDocumentStatus,
  insertNewDocumentFromGreenInvoice,
} from '@modules/green-invoice/helpers/green-invoice.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { Currency, DocumentType } from '@shared/enums';
import { GreenInvoiceLinkType } from '@shared/gql-types';
import { dateToTimelessDateString } from '@shared/helpers';
import {
  filterAndHandleSwiftTransactions,
  getIncomeFromDocuments,
  getPaymentsFromTransactions,
  getTypeFromDocumentsAndTransactions,
} from '../helpers/issue-document.helper.js';
import { GreenInvoiceProvider } from '../providers/green-invoice.provider.js';
import type { GreenInvoiceModule } from '../types.js';

export const greenInvoiceResolvers: GreenInvoiceModule.Resolvers = {
  Query: {
    greenInvoiceBusinesses: async (_, __, { injector }) => {
      try {
        const matches = await injector.get(GreenInvoiceProvider).getAllBusinessMatches();

        return matches;
      } catch (error) {
        const message = 'Failed to fetch green invoice businesses';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
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

      const businessPromise = charge.business_id
        ? injector.get(GreenInvoiceProvider).getBusinessMatchByIdLoader.load(charge.business_id)
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

      const [business, openIssuedDocuments] = await Promise.all([
        businessPromise,
        openIssuedDocumentsPromise,
      ]);

      const greenInvoiceDocuments = await Promise.all(
        openIssuedDocuments.map(doc =>
          injector
            .get(GreenInvoiceClientProvider)
            .getDocument({ id: doc.external_id })
            .then(res => {
              if (!res) {
                console.error('Failed to fetch document from Green Invoice', doc.external_id);
                return null;
              }
              return res;
            }),
        ),
      ).then(res => res.filter(Boolean) as Document[]);

      const payment = await getPaymentsFromTransactions(injector, transactions);
      const income = getIncomeFromDocuments(
        openIssuedDocuments.map(doc => ({
          document: documents.find(d => d.id === doc.id)!,
          issuedDocument: doc,
          greenInvoiceDocument: greenInvoiceDocuments.find(gd => gd.id === doc.external_id)!,
        })),
      );
      const linkedDocumentIds = openIssuedDocuments.map(doc => doc.external_id);
      const linkType: GreenInvoiceLinkType | undefined = linkedDocumentIds.length
        ? 'LINK'
        : undefined;

      const type = getTypeFromDocumentsAndTransactions(greenInvoiceDocuments, transactions);

      let remarks = charge.user_description;
      if (greenInvoiceDocuments.length) {
        remarks = greenInvoiceDocuments.map(doc => doc.remarks).join(', ');
        switch (type) {
          case DocumentType.Receipt:
          case DocumentType.InvoiceReceipt:
            remarks = `${getGreenInvoiceDocumentNameFromType(type)} for ${greenInvoiceDocuments.map(doc => `${getGreenInvoiceDocumentNameFromType(doc.type)} ${doc.number}`).join(', ')}`;
            break;
        }
      } else if (business?.business_id) {
        const greenInvoiceBusinessMatch = await injector
          .get(GreenInvoiceProvider)
          .getBusinessMatchByIdLoader.load(business.business_id);
        if (greenInvoiceBusinessMatch?.remark) {
          remarks = greenInvoiceBusinessMatch.remark;
        }
      }

      return {
        remarks,
        // description: ____,
        // footer: ____,
        type,
        date: dateToTimelessDateString(new Date()),
        dueDate: dateToTimelessDateString(endOfMonth(new Date())),
        lang: 'ENGLISH',
        currency: (charge.transactions_currency ||
          charge.documents_currency ||
          defaultCryptoConversionFiatCurrency) as Currency,
        vatType: 'DEFAULT',
        rounding: false,
        signed: true,
        client: business?.business_id
          ? {
              id: business.business_id,
            }
          : undefined,
        income,
        payment,
        // linkedPaymentId: ____,
        // maxPayments: _____,
        // discount: _____,
        linkedDocumentIds,
        linkType,
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

      const businessPromise = charge.business_id
        ? injector.get(GreenInvoiceProvider).getBusinessMatchByIdLoader.load(charge.business_id)
        : Promise.resolve(undefined);

      const openIssuedDocumentPromise = injector
        .get(IssuedDocumentsProvider)
        .getIssuedDocumentsByIdLoader.load(document.id);
      const [business, openIssuedDocument] = await Promise.all([
        businessPromise,
        openIssuedDocumentPromise,
      ]);

      if (!openIssuedDocument) {
        throw new GraphQLError(
          `Document with ID "${document.id}" doesn't seem like a document we issued`,
        );
      }

      if (openIssuedDocument.status !== 'OPEN') {
        throw new GraphQLError(`Document with ID "${document.id}" is closed`);
      }

      const greenInvoiceDocument: Document | null = await injector
        .get(GreenInvoiceClientProvider)
        .getDocument({ id: openIssuedDocument.external_id })
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

      if (!greenInvoiceDocument) {
        throw new GraphQLError(
          `Document with ID "${document.id}" doesn't have a Green Invoice matching document`,
        );
      }

      const payment = await (transactions
        ? getPaymentsFromTransactions(injector, transactions)
        : Promise.resolve([]));
      const income = getIncomeFromDocuments([
        {
          document,
          issuedDocument: openIssuedDocument,
          greenInvoiceDocument,
        },
      ]);
      const linkedDocumentIds = [openIssuedDocument.id];
      const linkType: GreenInvoiceLinkType | undefined = linkedDocumentIds.length
        ? 'LINK'
        : undefined;

      const type = getTypeFromDocumentsAndTransactions([greenInvoiceDocument], transactions ?? []);

      let remarks = greenInvoiceDocument.remarks;
      if (!remarks && business?.business_id) {
        const greenInvoiceBusinessMatch = await injector
          .get(GreenInvoiceProvider)
          .getBusinessMatchByIdLoader.load(business.business_id);
        if (greenInvoiceBusinessMatch?.remark) {
          remarks = greenInvoiceBusinessMatch.remark;
        }
      }

      return {
        remarks,
        // description: ____,
        // footer: ____,
        type,
        date: dateToTimelessDateString(new Date()),
        dueDate: dateToTimelessDateString(endOfMonth(new Date())),
        lang: 'ENGLISH',
        currency: (charge.transactions_currency ||
          charge.documents_currency ||
          defaultCryptoConversionFiatCurrency) as Currency,
        vatType: 'DEFAULT',
        rounding: false,
        signed: true,
        client: business?.business_id
          ? {
              id: business.business_id,
            }
          : undefined,
        income,
        payment,
        // linkedPaymentId: ____,
        // maxPayments: _____,
        // discount: _____,
        linkedDocumentIds,
        linkType,
      };
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
      const documentsToUpdate: IUpdateIssuedDocumentParams[] = [];
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

          const docToUpdate: Partial<IUpdateIssuedDocumentParams> = {};
          // check if the document status has changed
          const latestStatus = greenInvoiceToDocumentStatus(item.status);
          if (latestStatus !== existingDoc.status) {
            docToUpdate.status = latestStatus;
          }
          // check if the document amount has changed
          const linkedDocuments = await getLinkedDocuments(injector, item.id);
          if (
            linkedDocuments?.length &&
            (!existingDoc.linked_document_ids ||
              existingDoc.linked_document_ids.length !== linkedDocuments.length ||
              existingDoc.linked_document_ids?.some(id => !linkedDocuments.includes(id)))
          ) {
            docToUpdate.linkedDocumentIds = linkedDocuments;
          }
          // if has attributes to update, add to the update list
          if (Object.keys(docToUpdate).length > 0) {
            documentsToUpdate.push({
              documentId: existingDoc.id,
              ...docToUpdate,
            });
          }
        }),
      );

      const addedDocs: IInsertDocumentsResult[] = [];

      // run insertions and updates in parallel
      const newDocumentsPromises = newDocuments.map(async greenInvoiceDoc => {
        const newDocument = await insertNewDocumentFromGreenInvoice(
          injector,
          greenInvoiceDoc,
          ownerId,
        );

        if (newDocument) {
          addedDocs.push(newDocument);
        }
      });
      const documentsToUpdatePromises = documentsToUpdate.map(async docToUpdate => {
        await injector
          .get(IssuedDocumentsProvider)
          .updateIssuedDocument(docToUpdate)
          .catch(e => {
            console.error('Failed to update issued document linked documents', e);
            throw new GraphQLError(
              `Failed to update issued document linked documents for Green Invoice ID: ${docToUpdate.documentId}`,
            );
          });
      });
      await Promise.all([...newDocumentsPromises, ...documentsToUpdatePromises]);

      return addedDocs;
    },
    generateMonthlyClientDocuments: async (
      _,
      { generateDocumentsInfo, issueMonth },
      { injector },
    ) => {
      const errors: string[] = [];

      const proformaProtos = await Promise.all(
        generateDocumentsInfo.map(async docInfo => {
          const businessPromise = injector
            .get(BusinessesProvider)
            .getBusinessByIdLoader.load(docInfo.businessId);
          const businessGreenInvoiceMatchPromise = injector
            .get(GreenInvoiceProvider)
            .getBusinessMatchByIdLoader.load(docInfo.businessId);
          const [business, businessGreenInvoiceMatch] = await Promise.all([
            businessPromise,
            businessGreenInvoiceMatchPromise,
          ]);

          if (!business) {
            throw new GraphQLError(`Business ID="${docInfo.businessId}" not found`);
          }

          if (!businessGreenInvoiceMatch) {
            throw new GraphQLError(
              `Green invoice match not found for business ID="${docInfo.businessId}"`,
            );
          }

          const today = issueMonth ? addMonths(new Date(issueMonth), 1) : new Date();
          const monthStart = dateToTimelessDateString(startOfMonth(today));
          const monthEnd = dateToTimelessDateString(endOfMonth(today));
          const year = today.getFullYear() + (today.getMonth() === 0 ? -1 : 0);
          const month = format(subMonths(today, 1), 'MMMM');

          const documentInput: addDocumentRequest_Input & { businessName: string } = {
            businessName: business.name,
            type: getGreenInvoiceDocumentType(
              businessGreenInvoiceMatch.document_type as DocumentType,
            ),
            remarks: businessGreenInvoiceMatch.remark ?? undefined,
            date: monthStart,
            dueDate: monthEnd,
            lang: 'en',
            currency: convertCurrencyToGreenInvoice(docInfo.amount.currency),
            vatType: '_1',
            rounding: false,
            signed: true,
            attachment: true,
            client: {
              id: businessGreenInvoiceMatch.green_invoice_id,
              emails: [...(businessGreenInvoiceMatch.emails ?? []), 'ap@the-guild.dev'], // TODO: move ap email to DB context
            },
            income: [
              {
                description: `GraphQL Hive Enterprise License - ${month} ${year}`,
                quantity: 1,
                price: docInfo.amount.raw,
                currency: convertCurrencyToGreenInvoice(docInfo.amount.currency),
                vatType: '_1',
              },
            ],
          };

          return documentInput;
        }),
      );

      for (const proformaProto of proformaProtos) {
        const { businessName, ...input } = proformaProto;
        await injector
          .get(GreenInvoiceClientProvider)
          .addDocuments({ input })
          .then(res => {
            if (res && 'errorMessage' in res) {
              errors.push(`${businessName}: ${res.errorMessage}`);
            }
          })
          .catch(e => {
            console.error(e);
            errors.push(`${businessName}: ${e.message}`);
          });
      }

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
      const coreInput = await convertDocumentInputIntoGreenInvoiceInput(initialInput, injector);
      const input = {
        ...coreInput,
        client: coreInput.client
          ? {
              ...coreInput.client,
              emails: sendEmail ? coreInput.client?.emails : [],
            }
          : undefined,
        emailContent,
        attachment,
      };
      const document = await injector.get(GreenInvoiceClientProvider).addDocuments({ input });

      if (!document) {
        throw new GraphQLError('Failed to issue new document');
      }

      if ('id' in document && document.id) {
        const greenInvoiceDocument = await injector.get(GreenInvoiceClientProvider).getDocument({
          id: document.id,
        });
        if (!greenInvoiceDocument) {
          console.error('Failed to fetch issued document from Green Invoice', document);
          throw new GraphQLError('Failed to issue new document');
        }

        // Close linked documents
        if (coreInput.linkedDocumentIds?.length) {
          await Promise.all(
            coreInput.linkedDocumentIds.map(async id => {
              if (id) {
                await injector.get(GreenInvoiceClientProvider).closeDocument({ id });
              }
            }),
          );
        }

        // Insert new issued document to DB
        const newDocument = await insertNewDocumentFromGreenInvoice(
          injector,
          greenInvoiceDocument,
          defaultAdminBusinessId,
          chargeId,
        );

        if (!newDocument.charge_id) {
          console.error('New document does not have a charge ID', newDocument);
          throw new GraphQLError('Failed to issue new document');
        }

        return injector.get(ChargesProvider).getChargeByIdLoader.load(newDocument.charge_id);
      }

      console.error('Document issue failed', document);
      throw new GraphQLError('Document issue failed');
    },
  },
  GreenInvoiceBusiness: {
    id: business => business.green_invoice_id,
    originalBusiness: async (business, _, { injector }) => {
      const businessMatch = await injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(business.business_id);

      if (!businessMatch) {
        throw new GraphQLError('Business match not found');
      }

      return businessMatch;
    },
    greenInvoiceId: business => business.green_invoice_id,
    remark: business => business.remark,
    emails: business => business.emails ?? [],
    generatedDocumentType: business => business.document_type as DocumentType,
  },
};
