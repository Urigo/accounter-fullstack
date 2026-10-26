import { useMemo, type ReactElement, type ReactNode } from 'react';
import { ROUTES } from '@/router/routes.js';
import {
  ForeignSecuritiesChargeInfoFragmentDoc,
  type ForeignSecuritiesChargeInfoFragment,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { cn } from '../../../lib/utils.js';
import {
  distinctSecurityAccounts,
  readSecurityAccount,
  SecurityAccountBadge,
  type SecurityAccount,
} from '../../securities/security-account.js';
import { SecurityDescriptorBadges } from '../../securities/security-descriptor-badges.js';
import {
  formatSecurityDate,
  SecurityExecutionsTable,
} from '../../securities/security-executions-table.js';
import { SecurityHeading } from '../../securities/security-heading.js';
import { Badge } from '../../ui/badge.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ForeignSecuritiesChargeInfo on Charge {
    id
    __typename
    counterparty {
      id
    }
    ... on ForeignSecuritiesCharge {
      counterparties {
        id
      }
      securities {
        id
        securityKey
        isOffsetting
        netAmount {
          raw
          formatted
        }
        details {
          id
          engName
          hebName
          symbol
          itemType
          stockType
          exchange
          currencyCode
          isEtf
          asOfDate
        }
        securityBusiness {
          id
          isin
          symbol
          engName
          hebName
          ...SecurityDescriptorFields
        }
        executions {
          id
          ...SecurityExecutionFields
          account {
            id
            ...SecurityAccountFields
          }
        }
      }
    }
  }
`;

type ChargeSecurity = Extract<
  ForeignSecuritiesChargeInfoFragment,
  { __typename: 'ForeignSecuritiesCharge' }
>['securities'][number];

type Props = {
  chargeProps: FragmentType<typeof ForeignSecuritiesChargeInfoFragmentDoc>;
};

/** How a security stands toward the charge's counterparty */
type SecurityRole =
  | { kind: 'main' }
  | { kind: 'co-main'; index: number; total: number }
  | { kind: 'offsetting' }
  | { kind: 'none' };

export const ForeignSecuritiesInfo = ({ chargeProps }: Props): ReactNode => {
  const charge = getFragmentData(ForeignSecuritiesChargeInfoFragmentDoc, chargeProps);

  // The fragment sits on the Charge interface, so narrow before reading the field.
  const { sections, spansSeveral } = useMemo(() => {
    if (charge.__typename !== 'ForeignSecuritiesCharge') {
      return { sections: [], spansSeveral: 0 };
    }
    const counterpartyIds = charge.counterparties.map(({ id }) => id);
    const isMulti = !charge.counterparty && counterpartyIds.length > 1;
    // roles only tell securities apart — a charge of a single security needs none
    const hasRoles = charge.securities.length > 1;

    const withRoles = charge.securities.map(security => {
      const businessId = security.securityBusiness?.id;
      let role: SecurityRole = { kind: 'none' };
      if (!hasRoles) {
        return { security, role };
      }
      if (security.isOffsetting) {
        role = { kind: 'offsetting' };
      } else if (businessId && businessId === charge.counterparty?.id) {
        role = { kind: 'main' };
      } else if (isMulti && businessId && counterpartyIds.includes(businessId)) {
        role = {
          kind: 'co-main',
          index: counterpartyIds.indexOf(businessId) + 1,
          total: counterpartyIds.length,
        };
      }
      return { security, role };
    });

    // the securities that carry the charge first, the ones that cancel out last
    const rank = (role: SecurityRole) =>
      role.kind === 'main' || role.kind === 'co-main' ? 0 : role.kind === 'none' ? 1 : 2;
    withRoles.sort((a, b) => rank(a.role) - rank(b.role));

    return { sections: withRoles, spansSeveral: isMulti ? counterpartyIds.length : 0 };
  }, [charge]);

  return sections.length ? (
    <div className="flex flex-col gap-6">
      {spansSeveral > 0 && (
        <div className="text-sm text-gray-500">
          This charge spans {spansSeveral} securities, so it has no single counterparty. Each trade
          is booked against its own security.
        </div>
      )}
      {sections.map(({ security, role }) => (
        <SecuritySection key={security.id} security={security} role={role} />
      ))}
    </div>
  ) : null;
};

const RoleBadge = ({ role }: { role: SecurityRole }): ReactNode => {
  switch (role.kind) {
    case 'main':
      return <Badge>Main counterparty</Badge>;
    case 'co-main':
      return (
        <Badge variant="secondary">
          Counterparty {role.index} of {role.total}
        </Badge>
      );
    case 'offsetting':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-gray-500">
              Nets to zero
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Buys and sells of this security cancel out within the charge, so it is not used as the
            charge&apos;s counterparty.
          </TooltipContent>
        </Tooltip>
      );
    default:
      return null;
  }
};

const SecurityHeaderStrip = ({
  security,
  role,
  accounts,
}: {
  security: ChargeSecurity;
  role: SecurityRole;
  accounts: readonly SecurityAccount[];
}): ReactElement => (
  <div className="flex shrink-0 flex-row items-center gap-3">
    {accounts.length > 0 && (
      // FIFO costs a sale from the lots of its own account, so say which account it was
      <span className="flex flex-row flex-wrap items-center gap-1 text-sm text-gray-500">
        {accounts.length > 1 ? 'Accounts' : 'Account'}
        {accounts.map(account => (
          <SecurityAccountBadge key={account.id} account={account} />
        ))}
      </span>
    )}
    {security.netAmount && (
      <span className="text-sm text-gray-500">
        Net{' '}
        <span
          className={cn(
            'font-medium',
            security.netAmount.raw < 0 && 'text-red-600',
            security.netAmount.raw > 0 && 'text-green-700',
          )}
        >
          {security.netAmount.formatted}
        </span>
      </span>
    )}
    <RoleBadge role={role} />
  </div>
);

const SecuritySection = ({
  security,
  role,
}: {
  security: ChargeSecurity;
  role: SecurityRole;
}): ReactElement => {
  const { details, securityBusiness } = security;
  // a charge's trades are usually all in one account; a list per account when they are not
  const accounts = distinctSecurityAccounts(
    security.executions.map(execution => readSecurityAccount(execution.account)),
  );
  const businessHref = securityBusiness
    ? ROUTES.BUSINESSES.DETAIL_TAB(securityBusiness.id, 'security')
    : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row flex-wrap items-start justify-between gap-2">
        {/* a security whose trades cancel out is dimmed, not hidden */}
        <div className={cn(role.kind === 'offsetting' && 'opacity-60')}>
          {details ? (
            <div className="flex flex-col gap-1">
              <SecurityHeading
                name={details.engName}
                symbol={details.symbol}
                hebName={details.hebName}
                href={businessHref}
              >
                {securityBusiness ? (
                  // Locality vs. the tenant. Not details.isForeign, which is the bank's raw flag
                  <SecurityDescriptorBadges security={securityBusiness} />
                ) : (
                  // No security business yet, so locality is unknown: no Foreign badge
                  <div className="flex flex-row flex-wrap items-center gap-2">
                    {details.exchange && <Badge variant="secondary">{details.exchange}</Badge>}
                    <Badge variant="secondary">{details.currencyCode}</Badge>
                    <Badge variant="outline">{details.itemType}</Badge>
                    {details.stockType && <Badge variant="outline">{details.stockType}</Badge>}
                    {details.isEtf && <Badge variant="outline">ETF</Badge>}
                  </div>
                )}
              </SecurityHeading>
              <div className="text-xs text-gray-400">
                Key {security.securityKey} · reference data as of{' '}
                {formatSecurityDate(details.asOfDate)}
              </div>
            </div>
          ) : securityBusiness ? (
            // The reference list only carries what the portfolio held when it was scraped, so a
            // security closed out before then (a redeemed bond, say) has no row there — but its
            // executions still created a security business, linked by the Poalim key.
            <div className="flex flex-col gap-1">
              <SecurityHeading
                name={securityBusiness.engName ?? securityBusiness.isin}
                symbol={securityBusiness.symbol}
                hebName={securityBusiness.hebName}
                href={businessHref}
              >
                <SecurityDescriptorBadges security={securityBusiness} />
              </SecurityHeading>
              <div className="text-xs text-gray-400">
                Key {security.securityKey} · from the security&apos;s business (not in the ingested
                securities list)
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="text-lg font-semibold">Security {security.securityKey}</div>
              <div className="text-sm text-gray-500">
                No reference data or security business for this key yet — the securities list or the
                executions may not have been ingested.
              </div>
            </div>
          )}
        </div>
        <SecurityHeaderStrip security={security} role={role} accounts={accounts} />
      </div>
      {security.executions.length > 0 && (
        <TableSection title="Portfolio activity">
          <SecurityExecutionsTable
            rows={security.executions.map(execution => ({ execution }))}
            withAccount={accounts.length > 1}
          />
        </TableSection>
      )}
    </div>
  );
};

const TableSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactElement => (
  <div className="flex flex-col gap-1">
    <div className="text-sm font-medium text-gray-500">{title}</div>
    {children}
  </div>
);
