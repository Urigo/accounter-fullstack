import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { GraphQLError } from 'graphql';
import {
  DocumentInput_Input,
  Currency as GreenInvoiceCurrency,
} from '@accounter/green-invoice-graphql';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { GoogleDriveProvider } from '@modules/app-providers/google-drive/google-drive.provider.js';
import { GreenInvoiceProvider } from '@modules/app-providers/green-invoice.js';
import { deleteCharges } from '@modules/charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { BusinessesGreenInvoiceMatcherProvider } from '@modules/financial-entities/providers/businesses-green-invoice-match.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { EMPTY_UUID } from '@shared/constants';
import { Currency, DocumentType } from '@shared/enums';
import { Resolvers } from '@shared/gql-types';
import {
  dateToTimelessDateString,
  formatCurrency,
  optionalDateToTimelessDateString,
} from '@shared/helpers';
import {
  getGreenInvoiceDocumentType,
  normalizeDocumentType,
} from '../helpers/green-invoice.helper.js';
import { getDocumentFromFile } from '../helpers/upload.helper.js';
import { DocumentsProvider } from '../providers/documents.provider.js';
import type {
  DocumentsModule,
  IGetAllDocumentsResult,
  IInsertDocumentsParams,
  IInsertDocumentsResult,
  IUpdateDocumentParams,
} from '../types.js';
import {
  commonChargeFields,
  commonDocumentsFields,
  commonFinancialDocumentsFields,
} from './common.js';

export const documentsResolvers: DocumentsModule.Resolvers &
  Pick<
    Resolvers,
    'UpdateDocumentResult' | 'InsertDocumentResult' | 'UploadDocumentResult' | 'Document'
  > = {
  Query: {
    documents: async (_, __, { injector }) => {
      const dbDocs = await injector.get(DocumentsProvider).getAllDocuments();
      return dbDocs;
    },
    documentsByFilters: async (_, { filters }, { injector }) => {
      const dbDocs = await injector.get(DocumentsProvider).getDocumentsByExtendedFilters(filters);
      return dbDocs;
    },
    documentById: async (_, { documentId }, { injector }) => {
      const doc = await injector.get(DocumentsProvider).getDocumentsByIdLoader.load(documentId);
      return doc ?? null;
    },
  },
  Mutation: {
    uploadDocument: async (_, { file, chargeId }, context) => {
      const { injector } = context;

      try {
        const newDocument = await getDocumentFromFile(context, file, chargeId);

        const res = await injector
          .get(DocumentsProvider)
          .insertDocuments({ document: [{ ...newDocument }] });

        return { document: res[0] as IGetAllDocumentsResult };
      } catch (e) {
        const message = (e as Error)?.message ?? 'Unknown error';
        return {
          __typename: 'CommonError',
          message: `Error uploading document: ${message}`,
        };
      }
    },
    batchUploadDocuments: async (_, { documents, isSensitive, chargeId }, context) => {
      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      if (!chargeId) {
        // generate new charge
        const [newCharge] = await injector.get(ChargesProvider).generateCharge({
          ownerId: defaultAdminBusinessId,
          userDescription: 'New uploaded documents',
        });
        if (!newCharge) {
          throw new GraphQLError(`Failed to generate new charge for new document`);
        }
        chargeId = newCharge.id;
      }

      const newDocuments: Array<IInsertDocumentsParams['document'][number]> = [];
      await Promise.all(
        documents.map(async document => {
          // get new document data
          const newDocument = await getDocumentFromFile(context, document, chargeId, isSensitive);
          newDocuments.push(newDocument);
        }),
      );

      const res = await injector.get(DocumentsProvider).insertDocuments({ document: newDocuments });
      return res.map(document => ({ document: document as IGetAllDocumentsResult }));
    },
    batchUploadDocumentsFromGoogleDrive: async (
      _,
      { sharedFolderUrl, chargeId, isSensitive },
      context,
    ) => {
      const isValidGoogleDriveUrl = (url: string): boolean => {
        try {
          const parsedUrl = new URL(url);
          return (
            parsedUrl.hostname === 'drive.google.com' && parsedUrl.pathname.includes('/folders/')
          );
        } catch {
          return false;
        }
      };

      if (!isValidGoogleDriveUrl(sharedFolderUrl)) {
        throw new GraphQLError('Invalid Google Drive folder URL');
      }

      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      const files = await injector
        .get(GoogleDriveProvider)
        .fetchFilesFromSharedFolder(sharedFolderUrl);

      if (!chargeId) {
        // generate new charge
        const [newCharge] = await injector.get(ChargesProvider).generateCharge({
          ownerId: defaultAdminBusinessId,
          userDescription: 'New uploaded documents',
        });
        if (!newCharge) {
          throw new GraphQLError(`Failed to generate new charge for new document`);
        }
        chargeId = newCharge.id;
      }

      const newDocuments: Array<IInsertDocumentsParams['document'][number]> = [];
      await Promise.all(
        files.map(async file => {
          // get new document data
          try {
            const newDocument = await getDocumentFromFile(context, file, chargeId, isSensitive);
            newDocuments.push(newDocument);
          } catch (error) {
            // Skip this file and continue with other files
            console.error(error);
          }
        }),
      );

      const res = await injector.get(DocumentsProvider).insertDocuments({ document: newDocuments });
      return res.map(document => ({ document: document as IGetAllDocumentsResult }));
    },
    updateDocument: async (_, { fields, documentId }, { injector }) => {
      let postUpdateActions = async (): Promise<void> => void 0;

      try {
        let chargeId: string | undefined = undefined;

        if (fields.chargeId === EMPTY_UUID) {
          // case unlinked from charge
          const document = await injector
            .get(DocumentsProvider)
            .getDocumentsByIdLoader.load(documentId);
          if (!document) {
            throw new GraphQLError(`Document ID="${documentId}" not valid`);
          }
          if (document.charge_id) {
            const charge = await injector
              .get(ChargesProvider)
              .getChargeByIdLoader.load(document.charge_id);
            if (!charge) {
              throw new GraphQLError(
                `Former document's charge ID ("${fields.chargeId}") not valid`,
              );
            }

            // generate new charge
            const newCharge = await injector.get(ChargesProvider).generateCharge({
              ownerId: charge.owner_id,
              userDescription: 'Document unlinked from charge',
            });
            if (!newCharge || newCharge.length === 0) {
              throw new GraphQLError(
                `Failed to generate new charge for document ID="${documentId}"`,
              );
            }
            chargeId = newCharge?.[0]?.id;

            if (
              Number(charge.documents_count ?? 1) === 1 &&
              Number(charge.transactions_count ?? 0) === 0
            ) {
              postUpdateActions = async () => {
                try {
                  await deleteCharges([charge.id], injector);
                } catch (e) {
                  console.error(e);
                  throw new GraphQLError(
                    `Failed to delete the empty former charge ID="${charge.id}"`,
                  );
                }
                return postUpdateActions();
              };
            }
          }
        } else if (fields.chargeId) {
          // case new charge ID
          const charge = await injector
            .get(ChargesProvider)
            .getChargeByIdLoader.load(fields.chargeId);
          if (!charge) {
            throw new GraphQLError(`Charge ID="${fields.chargeId}" not valid`);
          }
          chargeId = charge.id;
        }

        const adjustedFields: IUpdateDocumentParams = {
          documentId,
          chargeId: chargeId ?? null,
          currencyCode: fields.amount?.currency ?? null,
          creditorId: fields.creditorId ?? null,
          debtorId: fields.debtorId ?? null,
          date: fields.date ? new Date(fields.date) : null,
          fileUrl: fields.file ? fields.file.toString() : null,
          imageUrl: fields.image ? fields.image.toString() : null,
          serialNumber: fields.serialNumber ?? null,
          totalAmount: fields.amount?.raw ?? null,
          type: fields.documentType ?? null,
          vatAmount: fields.vat?.raw ?? null,
          vatReportDateOverride: fields.vatReportDateOverride
            ? new Date(fields.vatReportDateOverride)
            : null,
          noVatAmount: fields.noVatAmount ?? null,
          isReviewed: true,
        };
        const res = await injector.get(DocumentsProvider).updateDocument({ ...adjustedFields });
        if (!res || res.length === 0) {
          throw new Error(`Document ID="${documentId}" not found`);
        }

        await postUpdateActions();

        return {
          document: res[0],
        };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
    deleteDocument: async (_, { documentId }, { injector }) => {
      const document = await injector
        .get(DocumentsProvider)
        .getDocumentsByIdLoader.load(documentId);
      if (!document) {
        throw new GraphQLError(`Document ID="${documentId}" not found`);
      }
      const res = await injector.get(DocumentsProvider).deleteDocument({ documentId });
      if (res.length === 1) {
        if (document.charge_id) {
          const charge = await injector
            .get(ChargesProvider)
            .getChargeByIdLoader.load(document.charge_id);
          if (charge && !charge.documents_count && !charge.transactions_count) {
            await deleteCharges([charge.id], injector);
          }
        }
        return true;
      }
      throw new GraphQLError(
        res.length === 0
          ? 'Document not found'
          : `More than one document found and deleted: ${res}`,
      );
    },
    insertDocument: async (_, { record }, { injector }) => {
      try {
        if (record.chargeId) {
          const charge = await injector
            .get(ChargesProvider)
            .getChargeByIdLoader.load(record.chargeId);

          if (!charge) {
            throw new Error(`Charge ID='${record.chargeId}' not found`);
          }
        }

        const newDocument: IInsertDocumentsParams['document']['0'] = {
          image: record.image ? record.image.toString() : null,
          file: record.file ? record.file.toString() : null,
          documentType: record.documentType ?? DocumentType.Unprocessed,
          serialNumber: record.serialNumber ?? null,
          date: record.date ? new Date(record.date) : null,
          amount: record.amount?.raw ?? null,
          currencyCode: record.amount?.currency ?? null,
          vat: record.vat?.raw ?? null,
          chargeId: record.chargeId ?? null,
          vatReportDateOverride: record.vatReportDateOverride
            ? new Date(record.vatReportDateOverride)
            : null,
          noVatAmount: record.noVatAmount ?? null,
          creditorId: record.creditorId ?? null,
          debtorId: record.debtorId ?? null,
        };
        const res = await injector
          .get(DocumentsProvider)
          .insertDocuments({ document: [{ ...newDocument }] });

        if (!res || res.length === 0) {
          throw new Error(`Failed to insert ledger record to charge ID='${record.chargeId}'`);
        }

        if (record.chargeId) {
          /* clear cache */
          injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.clear(record.chargeId);
        }

        return { document: res[0] };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Error inserting new ledger record:\n  ${
            (e as Error)?.message ?? 'Unknown error'
          }`,
        };
      }
    },
    fetchIncomeDocuments: async (
      _,
      { ownerId },
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      const data = await injector.get(GreenInvoiceProvider).searchDocuments({
        input: { pageSize: 100, sort: 'creationDate' },
      });
      if (!data?.items) {
        throw new GraphQLError('Failed to fetch documents');
      }
      if (data.items.length === 0) {
        return [];
      }

      const documents = await injector.get(DocumentsProvider).getAllDocuments();
      const newDocuments = data.items.filter(
        item =>
          item &&
          !documents.some(
            doc =>
              doc.vat_amount === item.vat &&
              doc.total_amount === item.amount &&
              doc.serial_number === item.number &&
              optionalDateToTimelessDateString(doc.date) === item.documentDate,
          ) &&
          item.type !== '_300',
      );
      const addedDocs: IInsertDocumentsResult[] = [];

      await Promise.all(
        newDocuments.map(async greenInvoiceDoc => {
          if (!greenInvoiceDoc) {
            return;
          }

          const documentType = normalizeDocumentType(greenInvoiceDoc.type);
          const isOwnerCreditor =
            greenInvoiceDoc.amount > 0 && documentType !== DocumentType.CreditInvoice;

          try {
            // generate preview image via cloudinary
            const imagePromise = injector
              .get(CloudinaryProvider)
              .uploadInvoiceToCloudinary(greenInvoiceDoc.url.origin);

            // Generate parent charge
            const chargePromise = injector.get(ChargesProvider).generateCharge({
              ownerId,
              userDescription:
                greenInvoiceDoc.description && greenInvoiceDoc.description !== ''
                  ? greenInvoiceDoc.description
                  : 'Green Invoice generated charge',
            });

            // Get matching business
            const businessPromise = injector
              .get(BusinessesGreenInvoiceMatcherProvider)
              .getBusinessMatchByGreenInvoiceIdLoader.load(greenInvoiceDoc.client.id);

            const [{ imageUrl }, [charge], business] = await Promise.all([
              imagePromise,
              chargePromise,
              businessPromise,
            ]);

            if (!charge) {
              throw new Error('Failed to generate charge');
            }

            const counterpartyId = business?.business_id ?? null;

            // insert document
            const rawDocument: IInsertDocumentsParams['document']['0'] = {
              image: imageUrl,
              file: greenInvoiceDoc.url.origin,
              documentType,
              serialNumber: greenInvoiceDoc.number,
              date: greenInvoiceDoc.documentDate,
              amount: greenInvoiceDoc.amount,
              currencyCode: formatCurrency(greenInvoiceDoc.currency),
              vat: greenInvoiceDoc.vat,
              chargeId: charge.id,
              vatReportDateOverride: null,
              noVatAmount: null,
              creditorId: isOwnerCreditor ? defaultAdminBusinessId : counterpartyId,
              debtorId: isOwnerCreditor ? counterpartyId : defaultAdminBusinessId,
            };

            const newDocumentPromise = injector
              .get(DocumentsProvider)
              .insertDocuments({ document: [rawDocument] });

            const chargeDescriptionUpdate = new Promise(resolve => {
              const income = greenInvoiceDoc.income;
              if (
                !income ||
                income.length === 0 ||
                !income[0]?.description ||
                income[0].description === ''
              ) {
                resolve(undefined);
              }

              const userDescription = income
                .filter(item => item?.description)
                .map(item => item!.description)
                .join(', ');

              injector
                .get(ChargesProvider)
                .updateCharge({
                  chargeId: charge.id,
                  userDescription,
                })
                .then(() => resolve(undefined));
            });

            const [newDocument] = await Promise.all([newDocumentPromise, chargeDescriptionUpdate]);

            addedDocs.push(newDocument[0]);
          } catch (e) {
            throw new GraphQLError(
              `Error adding Green Invoice document: ${e}\n\n${JSON.stringify(
                greenInvoiceDoc,
                null,
                2,
              )}`,
            );
          }
        }),
      );

      return addedDocs;
    },
    generateMonthlyClientDocuments: async (_, __, { injector }) => {
      const jsonArray: Array<{
        businessId: string;
        amount: number;
        currency: GreenInvoiceCurrency;
      }> = [
        {
          businessId: '147d3415-55e3-497f-acba-352dcc37cb8d', // uri test
          amount: 1000,
          currency: Currency.Ils,
        },
      ];

      const errors: string[] = [];

      const proformaProtos = await Promise.all(
        jsonArray.map(async json => {
          const businessPromise = injector
            .get(BusinessesProvider)
            .getBusinessByIdLoader.load(json.businessId);
          const businessGreenInvoiceMatchPromise = injector
            .get(BusinessesGreenInvoiceMatcherProvider)
            .getBusinessMatchByIdLoader.load(json.businessId);
          const [business, businessGreenInvoiceMatch] = await Promise.all([
            businessPromise,
            businessGreenInvoiceMatchPromise,
          ]);

          if (!business) {
            throw new GraphQLError(`Business ID="${json.businessId}" not found`);
          }

          if (!businessGreenInvoiceMatch) {
            throw new GraphQLError(
              `Green invoice match not found for business ID="${json.businessId}"`,
            );
          }

          const today = new Date();
          const monthStart = dateToTimelessDateString(startOfMonth(today));
          const monthEnd = dateToTimelessDateString(endOfMonth(today));
          const year = today.getFullYear() + (today.getMonth() === 0 ? -1 : 0);
          const month = format(subMonths(today, 1), 'MMMM');

          const documentInput: DocumentInput_Input & { businessName: string } = {
            businessName: business.name,
            type: getGreenInvoiceDocumentType(
              businessGreenInvoiceMatch.document_type as DocumentType,
            ),
            remarks: businessGreenInvoiceMatch.remark ?? undefined,
            date: monthStart,
            dueDate: monthEnd,
            lang: 'en',
            currency: json.currency,
            vatType: 1,
            rounding: false,
            signed: true,
            attachment: true,
            client: {
              id: businessGreenInvoiceMatch.green_invoice_id,
              emails: [...(businessGreenInvoiceMatch.emails ?? []), 'uri@the-guild.dev'],
            },
            income: [
              {
                description: `GraphQL Hive Enterprise License - ${month} ${year}`,
                quantity: 1,
                price: json.amount,
                currency: json.currency,
                vatType: 1,
              },
            ],
          };

          return documentInput;
        }),
      );

      for (const proformaProto of proformaProtos) {
        const { businessName, ...input } = proformaProto;
        await injector
          .get(GreenInvoiceProvider)
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
  },
  Document: {
    __resolveType: (documentRoot, _context, _info) => {
      switch (documentRoot?.type) {
        case DocumentType.Invoice: {
          return 'Invoice';
        }
        case DocumentType.Receipt: {
          return 'Receipt';
        }
        case DocumentType.InvoiceReceipt: {
          return 'InvoiceReceipt';
        }
        case DocumentType.CreditInvoice: {
          return 'CreditInvoice';
        }

        case DocumentType.Proforma: {
          return 'Proforma';
        }
        default: {
          return 'Unprocessed';
        }
      }
    },
  },
  UpdateDocumentResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'UpdateDocumentSuccessfulResult';
    },
  },
  InsertDocumentResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'InsertDocumentSuccessfulResult';
    },
  },
  UploadDocumentResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'UploadDocumentSuccessfulResult';
    },
  },
  Invoice: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  InvoiceReceipt: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  CreditInvoice: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  Proforma: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  Unprocessed: {
    ...commonDocumentsFields,
  },
  OtherDocument: {
    ...commonDocumentsFields,
  },
  Receipt: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  CommonCharge: commonChargeFields,
  FinancialCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
  MonthlyVatCharge: commonChargeFields,
  BankDepositCharge: commonChargeFields,
  CreditcardBankCharge: commonChargeFields,
};
