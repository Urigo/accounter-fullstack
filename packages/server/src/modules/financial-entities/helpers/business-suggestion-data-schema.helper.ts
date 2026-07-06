import { z } from 'zod';
import { isValidWildcardEmailPattern } from './email-pattern.helper.js';

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
