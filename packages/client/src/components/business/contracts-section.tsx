import { useState } from 'react';
import { Calendar, ExternalLink, LinkIcon, Pencil } from 'lucide-react';
import { useQuery } from 'urql';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { ClientContractsSectionDocument, type ClientContractsSectionQuery } from '@/gql/graphql.js';
import {
  formatAmountWithCurrency,
  getDocumentNameFromType,
  standardBillingCycle,
  standardPlan,
} from '@/helpers/index.js';
import {
  ModifyContractDialog,
  type ContractFormValues,
} from '../clients/contracts/modify-contract-dialog.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ClientContractsSection($clientId: UUID!) {
    contractsByClient(clientId: $clientId) {
      id
      purchaseOrders
      startDate
      endDate
      amount {
        raw
        currency
      }
      billingCycle
      isActive
      product
      documentType
      remarks
      plan
      msCloud
      operationsLimit
    }
  }
`;

function convertContractDataToFormValues(
  contract: ClientContractsSectionQuery['contractsByClient'][number],
): ContractFormValues {
  return {
    id: contract.id,
    pos: contract.purchaseOrders ?? undefined,
    startDate: contract.startDate,
    endDate: contract.endDate,
    paymentAmount: contract.amount.raw,
    paymentCurrency: contract.amount.currency,
    productType: contract.product ?? undefined,
    billingCycle: contract.billingCycle,
    msCloudLink: contract.msCloud?.toString(),
    isActive: contract.isActive,
    subscriptionPlan: contract.plan ?? undefined,
    defaultRemark: contract.remarks ?? undefined,
    defaultDocumentType: contract.documentType ?? undefined,
    operationsLimit: contract.operationsLimit,
  };
}

interface Props {
  clientId: string;
}

export function ContractsSection({ clientId }: Props) {
  const [editingContract, setEditingContract] = useState<ContractFormValues | null>(null);

  const [{ data, fetching }, refetch] = useQuery({
    query: ClientContractsSectionDocument,
    variables: {
      clientId,
    },
  });

  const contracts = data?.contractsByClient ?? [];

  if (fetching) {
    return <div>Loading contracts...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Contracts</CardTitle>
            <CardDescription>Current and past contracts sorted by start date</CardDescription>
          </div>
          <ModifyContractDialog clientId={clientId} contract={editingContract} onDone={refetch} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {contracts.map(contract => {
          const isActive = !!contract.isActive;

          return (
            <div key={contract.id} className="rounded-lg border p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{contract.product}</h4>
                    <Badge variant={isActive ? 'default' : 'secondary'}>
                      {contract.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">{contract.id}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingContract(convertContractDataToFormValues(contract))}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-0">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Contract Period
                  </p>
                  <p className="text-sm font-medium">
                    {new Date(contract.startDate).toLocaleDateString()} →{' '}
                    {new Date(contract.endDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="space-y-0">
                  <p className="text-sm text-muted-foreground">PO Numbers</p>
                  <p className="text-sm font-medium font-mono">
                    {contract.purchaseOrders.toReversed()[0] ?? ''}
                  </p>
                  {contract.purchaseOrders.length > 1 && (
                    <div className="space-x-1">
                      {contract.purchaseOrders
                        .toReversed()
                        .slice(1)
                        .map(po => (
                          <span key={po} className="text-xs font-thin font-mono">
                            {po}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                <div className="space-y-0">
                  <p className="text-sm text-muted-foreground">Payment</p>
                  <p className="text-sm font-medium">
                    {formatAmountWithCurrency(contract.amount.raw, contract.amount.currency)}
                  </p>
                </div>

                <div className="space-y-0">
                  <p className="text-sm text-muted-foreground">Billing Cycle</p>
                  <p className="text-sm font-medium">
                    {standardBillingCycle(contract.billingCycle)}
                  </p>
                </div>

                <div className="space-y-0">
                  <p className="text-sm text-muted-foreground">Subscription Plan</p>
                  <p className="text-sm font-medium">
                    {contract.plan ? standardPlan(contract.plan) : 'N/A'}
                  </p>
                </div>

                <div className="space-y-0">
                  <p className="text-sm text-muted-foreground">Operations Limit</p>
                  <p className="text-sm font-medium">{contract.operationsLimit.toLocaleString()}</p>
                </div>

                <div className="space-y-0">
                  <p className="text-sm text-muted-foreground">Document Type</p>
                  <p className="text-sm font-medium">
                    {getDocumentNameFromType(contract.documentType)}
                  </p>
                </div>
              </div>

              {contract.remarks && (
                <div className="space-y-0">
                  <p className="text-sm text-muted-foreground">Remark</p>
                  <p className="text-sm">{contract.remarks}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {contract.msCloud && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={contract.msCloud.toString()} target="_blank" rel="noopener noreferrer">
                      <LinkIcon className="h-4 w-4 mr-2" />
                      MS Cloud
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
