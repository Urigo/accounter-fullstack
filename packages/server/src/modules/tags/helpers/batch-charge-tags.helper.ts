import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ChargeTagsProvider } from '../providers/charge-tags.provider.js';

// Max charges processed in parallel. Keeps a large selection × many tags from
// fanning out unbounded DB work (one delete + N inserts per charge) and
// exhausting the connection pool.
const CHARGE_TAGS_CONCURRENCY = 5;

/**
 * Additive/subtractive tag update across many charges: adds `addTagIds` to and removes
 * `removeTagIds` from every charge in `chargeIds`, keeping each charge's other tags untouched.
 *
 * Unlike the charges module's `batchUpdateChargesTags` (which replaces a charge's whole tag set),
 * this only touches the given ids. Inserts are idempotent (`ON CONFLICT DO NOTHING`); removing a
 * tag a charge doesn't have is a harmless no-op. Removal happens before addition per charge, so an
 * id present in both lists ends up added ("add wins").
 */
export async function applyChargeTagChanges(
  injector: Injector,
  chargeIds: readonly string[],
  addTagIds: readonly string[],
  removeTagIds: readonly string[],
): Promise<void> {
  const chargeTagsProvider = injector.get(ChargeTagsProvider);

  for (let i = 0; i < chargeIds.length; i += CHARGE_TAGS_CONCURRENCY) {
    const chunk = chargeIds.slice(i, i + CHARGE_TAGS_CONCURRENCY);
    await Promise.all(
      chunk.map(async chargeId => {
        // Remove first so an id appearing in both lists ends up added.
        if (removeTagIds.length > 0) {
          await chargeTagsProvider
            .clearChargeTags({ chargeId, tagIDs: [...removeTagIds] })
            .catch(e => {
              console.error(e);
              throw new GraphQLError(
                `Error removing tags IDs="${removeTagIds}" from charge ID="${chargeId}"`,
              );
            });
        }
        for (const tagId of addTagIds) {
          await chargeTagsProvider.insertChargeTag({ chargeId, tagId }).catch(e => {
            console.error(e);
            throw new GraphQLError(`Error adding tag ID="${tagId}" to charge ID="${chargeId}"`);
          });
        }
      }),
    );
  }
}
