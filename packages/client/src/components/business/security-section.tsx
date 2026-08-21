import type { ReactElement } from 'react';
import { useQuery } from 'urql';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { BusinessSecuritySectionDocument } from '@/gql/graphql.js';
import { SecurityDescriptorBadges } from '../securities/security-descriptor-badges.js';
import {
  formatSecurityDate,
  formatSecurityDecimal,
  SecurityExecutionsTable,
} from '../securities/security-executions-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessSecuritySection($businessId: UUID!) {
    securityBusinessHistory(businessId: $businessId) {
      id
      security {
        id
        isin
        symbol
        engName
        hebName
        ...SecurityDescriptorFields
        identifiers {
          id
          type
          value
        }
      }
      position {
        id
        quantity
        averageCost {
          formatted
        }
        totalBought {
          formatted
        }
        totalSold {
          formatted
        }
        historyStartDate
        lastExecutionDate
      }
      executions {
        id
        charge {
          id
        }
        execution {
          id
          ...SecurityExecutionFields
        }
      }
    }
  }
`;

interface Props {
  businessId: string;
}

const Stat = ({ label, value }: { label: string; value: string }): ReactElement => (
  <div className="flex flex-col gap-1">
    <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

export function SecuritySection({ businessId }: Props): ReactElement {
  const [{ data, fetching }] = useQuery({
    query: BusinessSecuritySectionDocument,
    variables: { businessId },
  });

  if (fetching) {
    return <div>Loading security history...</div>;
  }

  const history = data?.securityBusinessHistory;
  if (!history) {
    return <div>No security details found for this business</div>;
  }

  const { security, position, executions } = history;
  const poalimKeys = security.identifiers
    .filter(identifier => identifier.type === 'POALIM_SECURITY_KEY')
    .map(identifier => identifier.value);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2">
            <CardTitle>
              {security.engName ?? security.isin}
              {security.symbol && <span className="text-gray-500"> ({security.symbol})</span>}
            </CardTitle>
            {security.hebName && <CardDescription>{security.hebName}</CardDescription>}
            <SecurityDescriptorBadges security={security} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Quantities can be fractional for ETFs and mutual funds. */}
            <Stat label="Current hold" value={formatSecurityDecimal(position.quantity)} />
            <Stat label="Average cost" value={position.averageCost?.formatted ?? '—'} />
            <Stat label="Total bought" value={position.totalBought?.formatted ?? '—'} />
            <Stat label="Total sold" value={position.totalSold?.formatted ?? '—'} />
          </div>
          <div className="text-xs text-gray-400">
            {position.historyStartDate
              ? `Added up from the scraped trades since ${formatSecurityDate(position.historyStartDate)}` +
                (position.lastExecutionDate
                  ? `, last one ${formatSecurityDate(position.lastExecutionDate)}`
                  : '') +
                '. The bank does not report a holding, so anything held before that date is not counted here.'
              : 'No executions ingested for this security yet.'}
            {poalimKeys.length > 0 && ` · Poalim key ${poalimKeys.join(', ')}`}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution history</CardTitle>
          <CardDescription>Every ingested action in this security, oldest first</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <SecurityExecutionsTable
              withChargeLink
              rows={executions.map(row => ({
                execution: row.execution,
                chargeId: row.charge?.id ?? null,
              }))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
