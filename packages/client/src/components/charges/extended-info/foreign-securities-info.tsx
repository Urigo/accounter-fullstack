import { useMemo, type ReactElement, type ReactNode } from 'react';
import { ROUTES } from '@/router/routes.js';
import {
  ForeignSecuritiesChargeInfoFragmentDoc,
  type ForeignSecuritiesChargeInfoFragment,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { SecurityDescriptorBadges } from '../../securities/security-descriptor-badges.js';
import {
  formatSecurityDate,
  SecurityExecutionsTable,
} from '../../securities/security-executions-table.js';
import { SecurityHeading } from '../../securities/security-heading.js';
import { Badge } from '../../ui/badge.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ForeignSecuritiesChargeInfo on Charge {
    id
    __typename
    ... on ForeignSecuritiesCharge {
      securities {
        id
        securityKey
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

export const ForeignSecuritiesInfo = ({ chargeProps }: Props): ReactNode => {
  const charge = getFragmentData(ForeignSecuritiesChargeInfoFragmentDoc, chargeProps);

  // The fragment sits on the Charge interface, so narrow before reading the field.
  const securities = useMemo(
    () => (charge.__typename === 'ForeignSecuritiesCharge' ? charge.securities : []),
    [charge],
  );

  return securities.length ? (
    <div className="flex flex-col gap-6">
      {securities.map(security => (
        <SecuritySection key={security.id} security={security} />
      ))}
    </div>
  ) : null;
};

const SecuritySection = ({ security }: { security: ChargeSecurity }): ReactElement => {
  const { details, securityBusiness } = security;
  const businessHref = securityBusiness
    ? ROUTES.BUSINESSES.DETAIL_TAB(securityBusiness.id, 'security')
    : undefined;

  return (
    <div className="flex flex-col gap-2">
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
            Key {security.securityKey} · reference data as of {formatSecurityDate(details.asOfDate)}
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
      {security.executions.length > 0 && (
        <TableSection title="Portfolio activity">
          <SecurityExecutionsTable rows={security.executions.map(execution => ({ execution }))} />
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
