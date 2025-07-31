import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { GraphQLError } from 'graphql';
import {
  addDocumentRequest_Input,
  Document,
  DocumentInputNew_Input,
} from '@accounter/green-invoice-graphql';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { IssuedDocumentsProvider } from '@modules/documents/providers/issued-documents.provider.js';
import type {
  IInsertDocumentsResult,
  IUpdateIssuedDocumentParams,
} from '@modules/documents/types.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import {
  convertCurrencyToGreenInvoice,
  getGreenInvoiceDocumentDiscountType,
  getGreenInvoiceDocumentLanguage,
  getGreenInvoiceDocumentLinkType,
  getGreenInvoiceDocumentPaymentAppType,
  getGreenInvoiceDocumentPaymentCardType,
  getGreenInvoiceDocumentPaymentDealType,
  getGreenInvoiceDocumentPaymentSubType,
  getGreenInvoiceDocuments,
  getGreenInvoiceDocumentType,
  getGreenInvoiceDocumentVatType,
  getLinkedDocuments,
  greenInvoiceToDocumentStatus,
  insertNewDocumentFromGreenInvoice,
} from '@modules/green-invoice/helpers/green-invoice.helper.js';
import { DocumentType } from '@shared/enums';
import { dateToTimelessDateString } from '@shared/helpers';
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
      const greenInvoiceClient = injector.get(GreenInvoiceClientProvider);
      const input: DocumentInputNew_Input = {
        ...initialInput,
        type: getGreenInvoiceDocumentType(initialInput.type),
        lang: getGreenInvoiceDocumentLanguage(initialInput.lang),
        vatType: getGreenInvoiceDocumentVatType(initialInput.vatType ?? 'DEFAULT'),
        discount: initialInput.discount
          ? {
              ...initialInput.discount,
              type: getGreenInvoiceDocumentDiscountType(initialInput.discount.type),
            }
          : undefined,
        client: initialInput.client
          ? {
              ...initialInput.client,
              emails: initialInput.client.emails?.length
                ? [...initialInput.client.emails]
                : undefined,
            }
          : undefined,
        income:
          initialInput.income?.map(income => ({
            ...income,
            vatType: getGreenInvoiceDocumentVatType(income.vatType ?? 'DEFAULT'),
          })) ?? [],
        payment: initialInput.payment?.map(payment => ({
          ...payment,
          subType: payment.subType
            ? getGreenInvoiceDocumentPaymentSubType(payment.subType)
            : undefined,
          appType: payment.appType
            ? getGreenInvoiceDocumentPaymentAppType(payment.appType)
            : undefined,
          cardType: payment.cardType
            ? getGreenInvoiceDocumentPaymentCardType(payment.cardType)
            : undefined,
          dealType: payment.dealType
            ? getGreenInvoiceDocumentPaymentDealType(payment.dealType)
            : undefined,
        })),
        linkedDocumentIds: initialInput.linkedDocumentIds?.length
          ? [...initialInput.linkedDocumentIds]
          : undefined,
        linkType: initialInput.linkType
          ? getGreenInvoiceDocumentLinkType(initialInput.linkType)
          : undefined,
      };
      const document = await greenInvoiceClient.previewDocuments({ input });

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
      { input: initialInput, emailContent, attachment },
      { injector },
    ) => {
      const greenInvoiceClient = injector.get(GreenInvoiceClientProvider);
      const input: addDocumentRequest_Input = {
        ...initialInput,
        type: getGreenInvoiceDocumentType(initialInput.type),
        lang: getGreenInvoiceDocumentLanguage(initialInput.lang),
        vatType: getGreenInvoiceDocumentVatType(initialInput.vatType ?? 'DEFAULT'),
        discount: initialInput.discount
          ? {
              ...initialInput.discount,
              type: getGreenInvoiceDocumentDiscountType(initialInput.discount.type),
            }
          : undefined,
        client: initialInput.client
          ? {
              ...initialInput.client,
              emails: initialInput.client.emails?.length
                ? [...initialInput.client.emails]
                : undefined,
            }
          : undefined,
        income:
          initialInput.income?.map(income => ({
            ...income,
            vatType: getGreenInvoiceDocumentVatType(income.vatType ?? 'DEFAULT'),
          })) ?? [],
        payment: initialInput.payment?.map(payment => ({
          ...payment,
          subType: payment.subType
            ? getGreenInvoiceDocumentPaymentSubType(payment.subType)
            : undefined,
          appType: payment.appType
            ? getGreenInvoiceDocumentPaymentAppType(payment.appType)
            : undefined,
          cardType: payment.cardType
            ? getGreenInvoiceDocumentPaymentCardType(payment.cardType)
            : undefined,
          dealType: payment.dealType
            ? getGreenInvoiceDocumentPaymentDealType(payment.dealType)
            : undefined,
        })),
        linkedDocumentIds: initialInput.linkedDocumentIds?.length
          ? [...initialInput.linkedDocumentIds]
          : undefined,
        linkType: initialInput.linkType
          ? getGreenInvoiceDocumentLinkType(initialInput.linkType)
          : undefined,
        emailContent,
        attachment,
      };
      const document = await greenInvoiceClient.addDocuments({ input });

      if (!document) {
        throw new GraphQLError('Failed to issue new document');
      }

      if ('id' in document && document.id) {
        // TODO:
        // - fetch new document
        // - add chargeId to variables
        // - if no chargeId, create a new charge
        // - follow the steps of fetchIncomeDocuments to add new doc to the DB
        // - return chargeId
        return document.id;
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
