import { z } from 'zod';
import type { BusinessBankAccountInput } from '../../../__generated__/types.js';

/** A single business bank account: bank, branch and account are all positive integers. */
export const businessBankAccountInputSchema = z.object({
  bankNumber: z.number().int().positive(),
  branchNumber: z.number().int().positive(),
  accountNumber: z.number().int().positive(),
});

/** Full replacement set of a business' bank accounts, de-duplicated by (bank, branch, account). */
export const businessBankAccountsInputSchema = z
  .array(businessBankAccountInputSchema)
  .superRefine((accounts, ctx) => {
    const seen = new Set<string>();
    for (const [index, account] of accounts.entries()) {
      const key = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate bank account: ${key}`,
          path: [index],
        });
      }
      seen.add(key);
    }
  });

export type BusinessBankAccountParsed = z.infer<typeof businessBankAccountInputSchema>;

/** Validate and normalize a bank-accounts input list, throwing on invalid data. */
export function parseBusinessBankAccounts(
  accounts: ReadonlyArray<BusinessBankAccountInput>,
): BusinessBankAccountParsed[] {
  return businessBankAccountsInputSchema.parse(accounts);
}
