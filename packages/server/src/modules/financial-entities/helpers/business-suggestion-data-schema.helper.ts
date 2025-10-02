import { z } from 'zod';

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
    emails: z.array(z.email()).optional(),
    emailListener: emailListener.optional(),
    priority: z.int().optional(),
  })
  .strict();

export type SuggestionData = z.infer<typeof suggestionDataSchema>;
