import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type {
  McpBatchUpdateChargesTagsMutation,
  McpCreateTagMutation,
  McpTagsForCreateQuery,
} from '../gql/index.js';
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

/**
 * Write tool: create a tag.
 *
 * Tagging charges needs tag ids, and a business that has never been categorised
 * (a newly onboarded one, say) has no tags to list — so without this tool the
 * model could tag nothing there until someone created the tags in the UI.
 *
 * Upstream `addTag` returns only `true`, and nothing stops two tags of one owner
 * sharing a name. The tool therefore reads the tag list around the mutation: once
 * before, to refuse a name the business already has (so a retry cannot create a
 * second one), and once after, to report the id of the tag it created.
 */

export const CREATE_TAG_TOOL_NAME = 'accounter_create_tag';

/** Longest tag name the tool accepts; a tag is a short label shown on every charge row. */
export const MAX_TAG_NAME_LENGTH = 100;

const createTagInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  name: z
    .string()
    .trim()
    .min(1)
    .max(MAX_TAG_NAME_LENGTH)
    .describe(
      'The tag name as it should appear on charges. The tool refuses a name the business ' +
        'already has (case-insensitive) and returns the existing id instead.',
    ),
  parentTagId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Nest the new tag under this tag (resolve the id with accounter_list_tags). Omit for a ' +
        'top-level tag.',
    ),
});
type CreateTagInput = z.infer<typeof createTagInput>;

const CREATE_TAG_MUTATION = /* GraphQL */ `
  mutation McpCreateTag($name: String!, $parentId: UUID) {
    addTag(name: $name, parentId: $parentId)
  }
`;

const TAGS_FOR_CREATE_QUERY = /* GraphQL */ `
  query McpTagsForCreate {
    allTags {
      id
      name
      namePath
      ownerId
    }
  }
`;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function createTagHandler(
  input: CreateTagInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  // A write targets exactly one business, and that is the scope the executor resolved.
  const owners = new Set(context.readScope.memberBusinessIds);
  const tagsOfTarget = async () => {
    const data = await context.client.query<McpTagsForCreateQuery>(
      { query: TAGS_FOR_CREATE_QUERY },
      context.upstream,
    );
    return data.allTags.filter(tag => !tag.ownerId || owners.has(tag.ownerId));
  };

  const before = await tagsOfTarget();
  const existing = before.find(tag => sameName(tag.name, input.name));
  if (existing) {
    throw new ToolInputError(`A tag named "${existing.name}" already exists`, [
      { path: 'name', message: `use the existing tag ${existing.id}` },
    ]);
  }

  const variables: Record<string, unknown> = { name: input.name };
  if (input.parentTagId !== undefined) variables.parentId = input.parentTagId;
  const data = await context.client.mutate<McpCreateTagMutation>(
    { query: CREATE_TAG_MUTATION, variables },
    context.upstream,
  );
  if (data.addTag !== true) {
    throw new UpstreamError('UPSTREAM_ERROR', 'Tag creation failed', false);
  }

  // `addTag` returns no id, so find the row that was not there before.
  const known = new Set(before.map(tag => tag.id));
  const created = (await tagsOfTarget()).find(
    tag => !known.has(tag.id) && sameName(tag.name, input.name),
  );
  const tags = created
    ? [
        {
          id: created.id,
          name: created.name,
          ownerId: created.ownerId,
          namePath: created.namePath ?? [created.name],
        },
      ]
    : [];

  return shapeWriteResult({
    action: 'create_tag',
    outcome: {
      tagId: created?.id ?? null,
      name: input.name,
      parentTagId: input.parentTagId ?? null,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'tags', values: tags },
    summary: created
      ? `Created tag "${created.name}" (${created.id}).`
      : `Created tag "${input.name}"; look its id up with accounter_list_tags.`,
  });
}

function observeCreateTag(input: CreateTagInput, result: ToolResult): ToolObservation {
  const structured = result.structuredContent as { tagId?: string | null } | undefined;
  return {
    fields: {
      nested: input.parentTagId !== undefined,
      // False when the tag was created but the re-read did not show it.
      resolvedTagId: !!structured?.tagId,
    },
  };
}

export const createTagTool: ToolDefinition<typeof createTagInput> = {
  name: CREATE_TAG_TOOL_NAME,
  description:
    'Create a tag for categorizing charges, so it can then be put on charges with ' +
    '`accounter_update_charges_tags`. Takes a `name` and, to nest the tag under another one, a ' +
    '`parentTagId`. A name the business already has is refused with the existing id, so a retry ' +
    'after an error cannot create a duplicate. Call `accounter_list_tags` first: a suitable tag ' +
    'may already exist under a slightly different name. ' +
    'The echo under `tags` is the new tag as `{ id, name, ownerId, namePath }`, its id also ' +
    'reported as `tagId` alongside `name` and `parentTagId`. `tagId` is null (and `tags` empty) ' +
    'only if the tag was created but could not be read back; resolve it with ' +
    '`accounter_list_tags` then, and do not create it again. ' +
    writeResultDescription('tags') +
    ' ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: createTagInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
    mutating: true,
  },
  handler: createTagHandler,
  observe: observeCreateTag,
};
