import type { ReactElement } from 'react';
import { Spinner } from '@/components/ui/spinner.js';
import { ProviderKey } from '@/gql/graphql.js';
import { useProviderCredentials } from '@/hooks/use-provider-credentials.js';
import { DeelCard } from './deel-card.js';
import { GreenInvoiceCard } from './green-invoice-card.js';

export function ProviderIntegrations(): ReactElement {
  const { data, fetching, refetch } = useProviderCredentials();

  if (fetching) {
    return (
      <div className="flex justify-center p-8">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  const greenInvoiceStatus = data?.find(s => s.provider === ProviderKey.GreenInvoice);
  const deelStatus = data?.find(s => s.provider === ProviderKey.Deel);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <GreenInvoiceCard status={greenInvoiceStatus} onSuccess={refetch} />
      <DeelCard status={deelStatus} onSuccess={refetch} />
    </div>
  );
}
