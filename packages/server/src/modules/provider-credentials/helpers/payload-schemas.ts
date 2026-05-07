import { z } from 'zod';

export const GreenInvoicePayloadSchema = z.object({
  id: z.string().min(1),
  secret: z.string().min(1),
});

export const DeelPayloadSchema = z.object({
  apiToken: z.string().min(1),
});

export type GreenInvoicePayload = z.infer<typeof GreenInvoicePayloadSchema>;
export type DeelPayload = z.infer<typeof DeelPayloadSchema>;
