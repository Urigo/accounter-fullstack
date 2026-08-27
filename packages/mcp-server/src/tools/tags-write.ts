import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type { McpBatchUpdateChargesTagsMutation } from '../gql/index.js';
import { UpstreamError } from '../upstream/graphql-client.js';
import { shapeWriteResult, writeResultDescription } from './output.js';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolObservation,
  ToolResult,
} from './registry.js';
import { WRITE_SCOPE_DESCRIPTION_SUFFIX, writeTargetBusinessIdInput } from './scope-input.js';

/**
 * Write tool: add and/or remove tags across many charges at once.
 *
 * Tags are identified by id, never by name. Name resolution is left to the model
 * via `accounter_list_tags` on purpose: names are not unique across owners, so
 * resolving them here would mean either guessing which of several same-named
 * tags was meant, or failing on an ambiguity the model is better placed to
 * settle. Ids make the write unambiguous.
 */

export const UPDATE_CHARGES_TAGS_TOOL_NAME = 'accounter_update_charges_tags';

/** Max charges updated in one call, matching the shared scope-input cap. */
export const MAX_CHARGES_PER_CALL = 50;
/** Max tag ids per direction (add / remove). */
export const MAX_TAG_IDS_PER_CALL = 50;

const tagIds = z.array(z.string().min(1)).max(MAX_TAG_IDS_PER_CALL).optional();

const updateChargesTagsInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  chargeIds: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_CHARGES_PER_CALL)
    .describe(
      `The charges to update (1-${MAX_CHARGES_PER_CALL} per call). Use accounter_search_charges to find ids.`,
    ),
  addTagIds: tagIds.describe(
    'Tag ids to add to every listed charge. Use accounter_list_tags to resolve names to ids.',
  ),
  removeTagIds: tagIds.describe('Tag ids to remove from every listed charge.'),
});
type UpdateChargesTagsInput = z.infer<typeof updateChargesTagsInput>;

const BATCH_UPDATE_CHARGES_TAGS_MUTATION = /* GraphQL */ `
  mutation McpBatchUpdateChargesTags(
    $chargeIds: [UUID!]!
    $addTagIds: [UUID!]
    $removeTagIds: [UUID!]
  ) {
    batchUpdateChargesTags(
      chargeIds: $chargeIds
      addTagIds: $addTagIds
      removeTagIds: $removeTagIds
    ) {
      __typename
      ... on BatchUpdateChargesTagsSuccessfulResult {
        charges {
          id
          tags {
            id
            name
          }
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

async function updateChargesTagsHandler(
  input: UpdateChargesTagsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const addTagIds = input.addTagIds ?? [];
  const removeTagIds = input.removeTagIds ?? [];
  // Upstream answers a no-op call with a CommonError; catching it here spends no
  // round trip and returns a field-level validation error instead of an opaque
  // upstream one.
  if (addTagIds.length === 0 && removeTagIds.length === 0) {
    throw new ToolInputError('No tag changes requested', [
      { path: 'addTagIds', message: 'provide at least one of addTagIds or removeTagIds' },
    ]);
  }

  const data = await context.client.mutate<McpBatchUpdateChargesTagsMutation>(
    {
      query: BATCH_UPDATE_CHARGES_TAGS_MUTATION,
      variables: {
        chargeIds: input.chargeIds,
        addTagIds: input.addTagIds ?? null,
        removeTagIds: input.removeTagIds ?? null,
      },
    },
    context.upstream,
  );

  const result = data.batchUpdateChargesTags;
  if (result.__typename !== 'BatchUpdateChargesTagsSuccessfulResult') {
    // A domain refusal upstream (unknown charge, no changes, …). Not retryable —
    // resending the identical request would be refused identically.
    throw new UpstreamError(
      'UPSTREAM_ERROR',
      result.__typename === 'CommonError' ? result.message : 'Tag update failed',
      false,
    );
  }

  const charges = result.charges.map(charge => ({
    id: charge.id,
    tags: charge.tags.map(tag => ({ id: tag.id, name: tag.name })),
  }));

  return shapeWriteResult({
    action: 'update_charges_tags',
    outcome: {
      updatedCount: charges.length,
      requestedCount: input.chargeIds.length,
      addedTagIds: addTagIds,
      removedTagIds: removeTagIds,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'charges', values: charges },
    summary: `Updated tags on ${charges.length} of ${input.chargeIds.length} requested charge(s).`,
  });
}

/**
 * Usage telemetry for one tag update.
 *
 * As with the upload tool, a write result has none of the list-shape fields the
 * executor logs automatically, so the counts have to come from here. Requested
 * and updated counts are both reported because their *difference* is the signal:
 * upstream silently skips a charge id it cannot resolve, so a call that asked
 * for 50 and updated 43 is the shape of a model working from stale ids.
 *
 * Ids themselves are deliberately left out. The pre-handler audit line already
 * carries them, and repeating them here would double the volume of the noisiest
 * field for no added answer.
 */
function observe(input: UpdateChargesTagsInput, result: ToolResult): ToolObservation {
  const structured = result.structuredContent as { updatedCount?: number } | undefined;
  return {
    fields: {
      requestedChargeCount: input.chargeIds.length,
      updatedChargeCount: structured?.updatedCount,
      addedTagCount: input.addTagIds?.length ?? 0,
      removedTagCount: input.removeTagIds?.length ?? 0,
    },
  };
}

export const updateChargesTagsTool: ToolDefinition<typeof updateChargesTagsInput> = {
  name: UPDATE_CHARGES_TAGS_TOOL_NAME,
  description:
    'Add and/or remove tags across one or more charges. Tags are given by id — call ' +
    '`accounter_list_tags` first to resolve names. This is an incremental edit, not a replacement: ' +
    'tags already on a charge and not listed in `removeTagIds` stay. Removals are applied before ' +
    'additions, so a tag id passed in BOTH lists ends up added. Adding a tag a charge already has ' +
    'does nothing. ' +
    'Each row echoes `{ id, tags }` for the charge as it now stands, alongside `updatedCount`, `requestedCount`, `addedTagIds` and `removedTagIds`. ' +
    writeResultDescription('charges') +
    ' ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: updateChargesTagsInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
    mutating: true,
  },
  handler: updateChargesTagsHandler,
  observe,
};
