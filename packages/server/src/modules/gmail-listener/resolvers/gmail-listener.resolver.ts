import type { BusinessEmailConfig } from '../../../__generated__/types.js';
import { hashStringToInt } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { getDocumentFromFile } from '../../documents/helpers/upload.helper.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { IInsertDocumentsParams } from '../../documents/types.js';
import { suggestionDataSchema } from '../../financial-entities/helpers/business-suggestion-data-schema.helper.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { EmailListenerConfig } from '../../financial-entities/types.js';
import type { GmailListenerModule } from '../types.js';

export const gmailListenerResolvers: GmailListenerModule.Resolvers = {
  Query: {
    businessEmailConfig: async (_, { email }, { injector }) => {
      const business = await injector.get(BusinessesProvider).getBusinessByEmail(email);

      if (!business) {
        return null;
      }

      let listenerConfig: EmailListenerConfig = {};
      if (business?.suggestion_data) {
        const { data, success, error } = suggestionDataSchema.safeParse(business.suggestion_data);
        if (success) {
          if (data.emailListener) {
            listenerConfig = data.emailListener;
          }
        } else {
          console.error(
            `Invalid suggestion_data schema for business "${business.name}" [${business.id}]: ${JSON.stringify(error.issues)}`,
          );
        }
      }

      const listenerConfigRes: Omit<BusinessEmailConfig, 'businessId'> = {
        internalEmailLinks: listenerConfig.internalEmailLinks,
        emailBody: listenerConfig.emailBody,
        attachments: listenerConfig.attachments,
      };

      return {
        ...listenerConfigRes,
        businessId: business.id,
      };
    },
  },
  Mutation: {
    insertEmailDocuments: async (
      _,
      { documents, userDescription, messageId, businessId },
      { injector },
    ) => {
      if (documents.length === 0) {
        return true;
      }

      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        const charge = await injector
          .get(ChargesProvider)
          .generateCharge({
            ownerId,
            userDescription,
          })
          .catch(e => {
            throw new Error(`Error generating charge for email id=${messageId}: ${e}`);
          });

        if (!charge?.id) {
          throw new Error(`Charge creation failed for email id=${messageId}`);
        }

        const newDocuments: Array<IInsertDocumentsParams['documents'][number]> = [];
        await Promise.all(
          documents.map(async doc => {
            const hash = hashStringToInt(await doc.text());

            const existingDocument = await injector
              .get(DocumentsProvider)
              .getDocumentByHash.load(hash);
            if (existingDocument) {
              console.log(
                `Document ${'name' in doc ? doc.name : 'unknown'} already exists in the database with id=${existingDocument.id}, skipping upload.`,
              );
              return;
            }

            // get new document data
            const newDocument = await getDocumentFromFile(
              injector,
              doc,
              charge.id,
              false,
              businessId ?? undefined,
            );
            newDocuments.push({ ...newDocument, remarks: userDescription });
          }),
        );

        await injector.get(DocumentsProvider).insertDocuments({ documents: newDocuments });

        return true;
      } catch (error) {
        console.error('Failed to insert email documents:', error);
        return false;
      }
    },
  },
};
