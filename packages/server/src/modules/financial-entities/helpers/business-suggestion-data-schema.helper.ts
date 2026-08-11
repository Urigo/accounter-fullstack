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

// Tenant-level email-ingestion policy, read off the tenant's *own* business row by
// EmailIngestionControlProvider.loadTenantMailContext. It exists because issuer
// recognition has to know which addresses belong to the tenant itself: mail
// forwarded in by a colleague, or relayed through the tenant's own group, otherwise
// resolves to the tenant's own business and is mistaken for a self-issued document.
const emailIngestion = z
  .object({
    // Domains the tenant owns. Every address on one of these is the tenant's, never
    // an issuer — this is what excludes colleagues who are not registered anywhere.
    // Deliberately explicit rather than inferred from the alias: inferring it from a
    // freemail alias would blacklist an entire public domain.
    ownDomains: z.array(z.string()).optional(),
    // Invoice-issuing platforms beyond the global defaults, for tenants billing
    // through something other than Morning/Sumit.
    extraPlatformSenders: z.array(recognitionEmail).optional(),
  })
  .strict();

export type EmailIngestionTenantConfig = z.infer<typeof emailIngestion>;

export const suggestionDataSchema = z
  .object({
    tags: z.array(z.uuid()).optional(),
    phrases: z.array(z.string()).optional(),
    description: z.string().optional(),
    emails: z.array(recognitionEmail).optional(),
    emailListener: emailListener.optional(),
    emailIngestion: emailIngestion.optional(),
    priority: z.int().optional(),
  })
  .strict();

export type SuggestionData = z.infer<typeof suggestionDataSchema>;
