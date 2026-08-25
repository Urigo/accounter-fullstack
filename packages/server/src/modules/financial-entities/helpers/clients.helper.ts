import { z } from 'zod';

/**
 * Zod schema matching the GraphQL `ClientIntegrations` type.
 *
 * Strict, and exported for a write path that wants to reject an unrecognized
 * key outright. Do NOT reach for it to read a value that is already stored —
 * see `parseStoredClientIntegrations` for why that direction must not throw.
 */
export const ClientIntegrationsSchema = z
  .object({
    greenInvoiceId: z.uuid().optional().nullable(),
    hiveId: z.string().optional().nullable(),
    linearId: z.string().optional().nullable(),
    slackChannelKey: z.string().optional().nullable(),
    notionId: z.string().optional().nullable(),
    workflowyUrl: z.string().optional().nullable(),
  })
  .strict();

export type ClientIntegrations = z.infer<typeof ClientIntegrationsSchema>;

// Per-field `.catch(null)` so one bad value degrades that field alone instead of
// the whole record, and unknown keys are stripped rather than rejected (a plain
// `z.object` strips by default).
const storedClientIntegrationsSchema = z.object({
  greenInvoiceId: z.uuid().nullish().catch(null),
  hiveId: z.string().nullish().catch(null),
  linearId: z.string().nullish().catch(null),
  slackChannelKey: z.string().nullish().catch(null),
  notionId: z.string().nullish().catch(null),
  workflowyUrl: z.string().nullish().catch(null),
});

/**
 * Parse an `integrations` jsonb value that is already in the database.
 *
 * Deliberately lenient, because reading and writing have opposite failure costs.
 * Rejecting a bad *payload* on a write is the point. Throwing on a bad *stored*
 * value takes down far more than the offending row: field resolvers run this
 * once per client, and the MCP connector discards partial data whenever a
 * response carries any `errors` entry — so a single malformed row would empty an
 * entire `allClients` result instead of degrading one record.
 *
 * Three ways a stored value can be bad, all of which must survive:
 * - `NULL` — the column is nullable, and `updateClient`'s COALESCE can land NULL.
 * - unknown keys — written by an older deploy, or left behind by a removed field.
 * - a wrong-typed value — hand-edited or migrated data.
 *
 * Every caller already guards the field it wants (`?? null`, or a domain error
 * on a missing `greenInvoiceId`), so an unreadable value surfaces as "not
 * configured" rather than as a failed request.
 */
export function parseStoredClientIntegrations(input: unknown): ClientIntegrations {
  if (input == null) {
    return {};
  }
  const { data, success, error } = storedClientIntegrationsSchema.safeParse(input);
  if (success) {
    return data;
  }
  // Reached only when the value is not an object at all — the per-field
  // `.catch(null)` above absorbs everything else.
  console.error(`Ignoring unparsable stored client integrations: ${error}`);
  return {};
}
