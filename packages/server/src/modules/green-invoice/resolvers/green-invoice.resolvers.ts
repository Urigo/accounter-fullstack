import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { GraphQLError } from 'graphql';
import { DocumentInput_Input } from '@accounter/green-invoice-graphql';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import type { IInsertDocumentsParams, IInsertDocumentsResult } from '@modules/documents/types.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import {
  convertCurrencyToGreenInvoice,
  getGreenInvoiceDocumentType,
  normalizeDocumentType,
} from '@modules/green-invoice/helpers/green-invoice.helper.js';
import { DocumentType } from '@shared/enums';
import {
  dateToTimelessDateString,
  formatCurrency,
  optionalDateToTimelessDateString,
} from '@shared/helpers';
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
      { ownerId },
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      const data = await injector.get(GreenInvoiceClientProvider).searchDocuments({
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
              .get(GreenInvoiceProvider)
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
              allocationNumber: null, // TODO: add allocation number from GreenInvoice API
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

          const documentInput: DocumentInput_Input & { businessName: string } = {
            businessName: business.name,
            type: getGreenInvoiceDocumentType(
              businessGreenInvoiceMatch.document_type as DocumentType,
            ),
            remarks: businessGreenInvoiceMatch.remark ?? undefined,
            date: monthStart,
            dueDate: monthEnd,
            lang: 'en',
            currency: convertCurrencyToGreenInvoice(docInfo.amount.currency),
            vatType: 1,
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
