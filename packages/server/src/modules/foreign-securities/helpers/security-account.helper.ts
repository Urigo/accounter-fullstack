import type { AccountTuple } from './match-security-executions.helper.js';

/** The account columns every execution row carries — the portfolio it was made in */
export type SecurityAccountColumns = {
  bank_number: number;
  branch_number: number;
  account_number: number;
};

/**
 * A portfolio account: the Poalim bank account a security is held in, as the executions identify
 * it. Carries its owner, because a bank/branch/account triple only names an account within one.
 */
export type SecurityAccountProto = AccountTuple & { ownerId: string };

/** "bank-branch-account": the account's id, and the key executions are grouped by account on */
export const securityAccountKey = (execution: SecurityAccountColumns): string =>
  `${execution.bank_number}-${execution.branch_number}-${execution.account_number}`;

export const securityAccountId = (account: AccountTuple): string =>
  `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;

export const securityAccountOf = (
  execution: SecurityAccountColumns & { owner_id: string },
): SecurityAccountProto => ({
  ownerId: execution.owner_id,
  bankNumber: execution.bank_number,
  branchNumber: execution.branch_number,
  accountNumber: execution.account_number,
});
