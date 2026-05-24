import { z } from 'zod';

const CurrencyRateEntrySchema = z.object({
  date: z.string(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'SEK']),
  rate: z.number(),
});

export const CurrencyRatesPayloadSchema = z.array(CurrencyRateEntrySchema);

export type CurrencyRatesPayload = z.infer<typeof CurrencyRatesPayloadSchema>;
