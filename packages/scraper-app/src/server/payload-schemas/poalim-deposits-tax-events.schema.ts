import { z } from 'zod';

/**
 * Asserts every field `poalimDepositTaxEventsVars` reads off
 * `savingsAndCurrentProductsTaxEvents[]`. Kept loose so an extra bank-side field
 * does not block an upload; the scraper package's strict schema is what flags it.
 */
const DepositTaxEventSchema = z
  .object({
    eventSerialNumber: z.number().int(),
    executingDate: z.number().int(),
    formattedExecutingDate: z.string().nullable(),
    actionTypeDescription: z.string(),
    shortProductName: z.string().nullable(),
    taxActionTypeDescription: z.string().nullable(),
    taxEventAmount: z.number(),
    debitCurrencyShortedDescription: z.string().nullable(),
    debitAmount: z.number(),
    crditAmount: z.number(),
    additionalInformationExistenceSwitch: z.number().int().nullable(),
  })
  .loose();

export const PoalimDepositsTaxEventsPayloadSchema = z
  .object({
    savingsAndCurrentProductsTaxEvents: z.array(DepositTaxEventSchema).default([]),
  })
  .loose();

export type PoalimDepositsTaxEventsPayload = z.infer<typeof PoalimDepositsTaxEventsPayloadSchema>;
