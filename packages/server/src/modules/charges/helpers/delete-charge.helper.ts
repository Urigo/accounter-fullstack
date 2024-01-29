import { GraphQLError } from 'graphql';
import { TagsProvider } from '@modules/tags/providers/tags.provider';
import { ChargesProvider } from '../providers/charges.provider';

export async function deleteCharge(
  chargeId: string,
  chargeProvider: ChargesProvider,
  tagsProvider: TagsProvider,
): Promise<void> {
  try {
    await tagsProvider.clearAllChargeTags({ chargeId });
  } catch (e) {
    console.error(`Failed to clear tags for charge ID="${chargeId}"`, e);
    throw new GraphQLError(`Failed to clear tags for charge ID="${chargeId}"`);
  }

  try {
    await chargeProvider.deleteChargesByIds({ chargeIds: [chargeId] });
  } catch (e) {
    console.error(`Failed to delete charge ID="${chargeId}"`, e);
    throw new GraphQLError(`Failed to delete charge ID="${chargeId}"`);
  }

  return void 0;
}
