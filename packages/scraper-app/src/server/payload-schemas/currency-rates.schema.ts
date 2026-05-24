import { z } from 'zod';

const CurrencyRateEntrySchema = z.object({
  date: z.string(),
  currency: z.enum(['AUD', 'CAD', 'EUR', 'GBP', 'JPY', 'SEK', 'UAH', 'USD']),
  rate: z.number(),
});

export const CurrencyRatesPayloadSchema = z.array(CurrencyRateEntrySchema);

export type CurrencyRatesPayload = z.infer<typeof CurrencyRatesPayloadSchema>;
