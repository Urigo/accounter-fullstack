import { GraphQLError } from 'graphql';
import { z } from 'zod';

// Zod schema matching the GraphQL `ClientIntegrations` type
export const ClientIntegrationsSchema = z
  .object({
    greenInvoiceId: z.uuid().optional().nullable(),
    hiveId: z.string().optional().nullable(),
    linearId: z.string().optional().nullable(),
    slackChannelKey: z.string().optional().nullable(),
    notionId: z.string().optional().nullable(),
    workflowyUrl: z.url().optional().nullable(),
  })
  .strict();

export type ClientIntegrations = z.infer<typeof ClientIntegrationsSchema>;

export function validateClientIntegrations(input: unknown): ClientIntegrations {
  try {
    const { data, success, error } = ClientIntegrationsSchema.safeParse(input);
    if (!success) {
      throw new Error(`Parsing error: ${error}`);
    }
    return data;
  } catch (error) {
    throw new GraphQLError(`Failed to validate client integrations: ${error}`);
  }
}
