import { z } from 'zod';

export const suggestionDataSchema = z.object({
  tags: z.array(z.uuid()).optional(),
  phrases: z.array(z.string()).optional(),
  description: z.string().optional(),
  emails: z.array(z.email()).optional(),
  internalEmailLinks: z.array(z.string()).optional(),
  priority: z.int().optional(),
});

export type SuggestionData = z.infer<typeof suggestionDataSchema>;
