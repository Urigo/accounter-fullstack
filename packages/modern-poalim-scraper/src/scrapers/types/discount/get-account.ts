import { z } from 'zod';

export const getAccountSchema = z.object({
  UserAccountsData: z.object({
    DefaultAccountNumber: z.string(),
  }),
});
