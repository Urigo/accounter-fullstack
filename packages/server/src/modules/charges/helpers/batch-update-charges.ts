import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import type { YearOfRelevanceInput } from '../../../__generated__/types.js';
import { EMPTY_UUID } from '../../../shared/constants.js';
import { BusinessTripsProvider } from '../../business-trips/providers/business-trips.provider.js';
import { ChargeTagsProvider } from '../../tags/providers/charge-tags.provider.js';
import { ChargeSpreadProvider } from '../providers/charge-spread.provider.js';

export async function batchUpdateChargesTags(
  injector: Injector,
  tags: string[],
  chargeIds: readonly string[],
) {
  const tagsPromises: Array<Promise<unknown>> = [];
  const pastTagsForCharges = await injector
    .get(ChargeTagsProvider)
    .getTagsByChargeIDLoader.loadMany(chargeIds)
    .then(res =>
      res.map((chargeTags, i) => {
        if (chargeTags instanceof Error) {
          console.error(
            `Error loading tags for charge ID="${chargeIds[i]}": ${chargeTags.message}`,
          );
          return [];
        }
        return chargeTags.map(tag => tag.id!);
      }),
    );
  for (const [i, pastTags] of pastTagsForCharges.entries()) {
    const chargeId = chargeIds[i];
    if (!chargeId) {
      throw new GraphQLError(`Charge ID at index ${i} is undefined`);
    }
    // clear removed tags
    const tagsToRemove = pastTags.filter(tagId => !tags.includes(tagId));
    if (tagsToRemove.length) {
      tagsPromises.push(
        injector
          .get(ChargeTagsProvider)
          .clearChargeTags({ chargeId, tagIDs: tagsToRemove })
          .catch(e => {
            console.error(e);
            throw new GraphQLError(
              `Error clearing tags IDs="${tagsToRemove}" to charge ID="${chargeId}"`,
            );
          }),
      );
    }
    // add new tags
    const tagIDsToAdd = tags.filter(tagId => !pastTags.includes(tagId));
    for (const tagId of tagIDsToAdd) {
      tagsPromises.push(
        injector
          .get(ChargeTagsProvider)
          .insertChargeTag({ chargeId, tagId })
          .catch(e => {
            console.error(e);
            throw new GraphQLError(`Error adding tag ID="${tagId}" to charge ID="${chargeId}"`);
          }),
      );
    }
  }
  await Promise.all(tagsPromises);
}

export async function batchUpdateChargesBusinessTrip(
  injector: Injector,
  businessTripID: string,
  chargeIds: readonly string[],
) {
  try {
    return Promise.all(
      chargeIds.map(chargeId =>
        injector
          .get(BusinessTripsProvider)
          .updateChargeBusinessTrip(
            chargeId,
            businessTripID === EMPTY_UUID ? null : businessTripID!,
          )
          .catch(e => {
            console.error(e);
            throw new GraphQLError(`Error updating business trip for charge ID="${chargeId}"`);
          }),
      ),
    );
  } catch (error) {
    if (error instanceof GraphQLError) {
      throw error;
    }
    console.error(error);
    throw new GraphQLError('An unexpected error occurred while updating charges business trip');
  }
}

export async function batchUpdateChargesYearsSpread(
  injector: Injector,
  yearsOfRelevance: readonly YearOfRelevanceInput[],
  chargeIds: readonly string[],
) {
  await injector
    .get(ChargeSpreadProvider)
    .deleteAllChargeSpreadByChargeIds({ chargeIds })
    .catch(e => {
      console.error(e);
      throw new GraphQLError(
        `Error deleting spread records for charge IDs "${chargeIds.join('", "')}"`,
      );
    });

  return Promise.all(
    chargeIds.map(chargeId =>
      injector
        .get(ChargeSpreadProvider)
        .insertChargeSpread({
          chargeSpread: yearsOfRelevance.map(record => ({
            chargeId,
            yearOfRelevance: record.year,
            amount: record.amount,
          })),
        })
        .catch(e => {
          console.error(e);
          throw new GraphQLError(`Error inserting spread records for charge ID="${chargeId}"`);
        }),
    ),
  );
}
