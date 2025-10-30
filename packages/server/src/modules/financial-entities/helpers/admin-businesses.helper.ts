import { z } from 'zod';

const yearlyIdSchema = z
  .object({
    year: z.number().min(2000).max(2100),
    id: z.string().min(1, { message: 'ID is required' }),
  })
  .strict();

const taxAdvanceRateSchema = z
  .object({
    date: z.iso.date(),
    rate: z.number().min(0).max(1),
  })
  .strict();

export const adminBusinessUpdateSchema = z
  .object({
    id: z.uuid(),
    businessRegistrationStartDate: z.iso.date().optional(),
    companyTaxId: z.string().optional(),
    advanceTaxRates: z.array(taxAdvanceRateSchema).optional(),
    taxAdvancesIds: z.array(yearlyIdSchema).optional(),
    socialSecurityEmployerIds: z.array(yearlyIdSchema).optional(),
    withholdingTaxAnnualIds: z.array(yearlyIdSchema).optional(),
  })
  .strict();

export type AdminBusinessUpdateSchema = z.infer<typeof adminBusinessUpdateSchema>;

export const yearlyIdsSchema = z.array(yearlyIdSchema);

export const taxAdvancesRatesSchema = z.array(taxAdvanceRateSchema);
