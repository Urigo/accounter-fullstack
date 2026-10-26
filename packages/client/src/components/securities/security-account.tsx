import type { ReactElement } from 'react';
import {
  SecurityAccountFieldsFragmentDoc,
  type SecurityAccountFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { Badge } from '../ui/badge.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SecurityAccountFields on SecurityAccount {
    id
    bankNumber
    branchNumber
    accountNumber
    financialAccount {
      id
      name
    }
  }
`;

export type SecurityAccount = SecurityAccountFieldsFragment;

export const readSecurityAccount = (
  account: FragmentType<typeof SecurityAccountFieldsFragmentDoc>,
): SecurityAccount => getFragmentData(SecurityAccountFieldsFragmentDoc, account);

/**
 * The account's name when the owner registered it as a financial account, else its numbers —
 * which is all the bank's securities feed names it by.
 */
export const securityAccountLabel = (account: SecurityAccount): string =>
  account.financialAccount?.name ??
  `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;

const securityAccountNumbers = (account: SecurityAccount): string =>
  `Bank ${account.bankNumber}, branch ${account.branchNumber}, account ${account.accountNumber}`;

/**
 * The accounts a list of executions was made in, once each, in the order they first appear.
 * Securities are held in more than one account, and FIFO costs a sale from its own account's lots.
 */
export const distinctSecurityAccounts = (
  accounts: readonly SecurityAccount[],
): SecurityAccount[] => [...new Map(accounts.map(account => [account.id, account])).values()];

export function SecurityAccountBadge({ account }: { account: SecurityAccount }): ReactElement {
  return (
    <Badge variant="outline" title={securityAccountNumbers(account)}>
      {securityAccountLabel(account)}
    </Badge>
  );
}
