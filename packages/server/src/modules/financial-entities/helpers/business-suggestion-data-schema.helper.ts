import { z } from 'zod';
import { isValidWildcardEmailPattern } from './email-pattern.helper.js';
import { cleanPhrases, dedupeList } from './list-input-validation.helper.js';

// A recognition email is either a concrete address or a wildcard pattern
// (e.g. `*@cloudflare.com`) for suppliers that send from a unique address per
// invoice. See email-pattern.helper.ts for the matching semantics.
const recognitionEmail = z
  .string()
  .refine(
    value => z.email().safeParse(value).success || isValidWildcardEmailPattern(value),
    'Must be a valid email address or wildcard email pattern (e.g. "*@cloudflare.com")',
  );

const emailListener = z
  .object({
    internalEmailLinks: z.array(z.string()).optional(),
    emailBody: z.boolean().optional(),
    attachments: z.array(z.enum(['PDF', 'PNG', 'JPEG'])).optional(),
  })
  .strict();

export type EmailListenerConfig = z.infer<typeof emailListener>;

export const suggestionDataSchema = z
  .object({
    tags: z.array(z.uuid()).optional(),
    phrases: z.array(z.string()).optional(),
    description: z.string().optional(),
    emails: z.array(recognitionEmail).optional(),
    emailListener: emailListener.optional(),
    priority: z.int().optional(),
  })
  .strict();

export type SuggestionData = z.infer<typeof suggestionDataSchema>;

/**
 * Defensively clean the list fields of a suggestion-data object before it is
 * persisted: drop duplicate recognition emails / internal email links
 * (case-insensitive) and duplicate or substring-overlapping phrases (keeping the
 * more specific phrase). The UI blocks these conflicts up front with a clear
 * message; this is the write-path safety net that also self-heals legacy data
 * and keeps automated merges from storing redundant entries. Shape validation is
 * still performed by the caller via `suggestionDataSchema`.
 */
export function normalizeSuggestionListData(data: SuggestionData): SuggestionData {
  const normalized: SuggestionData = { ...data };
  if (normalized.phrases) {
    normalized.phrases = cleanPhrases(normalized.phrases);
  }
  if (normalized.emails) {
    normalized.emails = dedupeList(normalized.emails);
  }
  if (normalized.emailListener?.internalEmailLinks) {
    normalized.emailListener = {
      ...normalized.emailListener,
      internalEmailLinks: dedupeList(normalized.emailListener.internalEmailLinks),
    };
  }
  return normalized;
}
