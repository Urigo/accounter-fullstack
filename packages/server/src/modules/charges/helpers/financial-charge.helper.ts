import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ChargeTagsProvider } from '@modules/tags/providers/charge-tags.provider.js';
import { TagsProvider } from '@modules/tags/providers/tags.provider.js';
import { ChargesTempProvider } from '../providers/charges-temp.provider.js';

const FINANCIAL_TAG_NAME = 'financial';

export async function generateAndTagCharge(
  injector: Injector,
  ownerId: string,
  taxCategoryId: string,
  description: string,
): Promise<string> {
  const charge = await injector.get(ChargesTempProvider).generateCharge({
    ownerId,
    userDescription: description,
    type: 'FINANCIAL',
    taxCategoryId,
  });

  if (!charge) {
    throw new Error('Error creating new charge');
  }

  const tag = await injector
    .get(TagsProvider)
    .getTagByNameLoader.load(FINANCIAL_TAG_NAME)
    .catch(() => {
      throw new GraphQLError(`Error finding "${FINANCIAL_TAG_NAME}" tag`);
    });

  if (!tag) {
    throw new GraphQLError(`"${FINANCIAL_TAG_NAME}" tag not found`);
  }

  await injector
    .get(ChargeTagsProvider)
    .insertChargeTag({ chargeId: charge.id, tagId: tag.id })
    .catch(() => {
      throw new GraphQLError(
        `Error adding "${FINANCIAL_TAG_NAME}" tag to charge ID="${charge.id}"`,
      );
    });

  return charge.id;
}
