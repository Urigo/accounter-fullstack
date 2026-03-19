import { type JSX } from 'react';
import { Loader2 } from 'lucide-react';
import type { FragmentType } from '@/gql/index.js';
import type { ClientIntegrationsSectionFragmentDoc } from '../../../../gql/graphql.js';
import { useOwnerBusiness } from '../../../../hooks/use-owner-business.js';
import { FinancialAccountsSection } from '../../../business/admin/financial-account-section.jsx';
import { IntegrationsSection } from '../../../business/client/integrations-section.jsx';
import { ConnectedSources } from '../connected-sources.js';

export function SourcesTab(): JSX.Element {
  const { business, businessId, isClient, isAdmin, isLoading, error } =
    useOwnerBusiness();

  return (
    <div className="space-y-8">
      <ConnectedSources />

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">Failed to load business data</p>
      )}

      {!isLoading && isAdmin && businessId && (
        <div>
          <h3 className="text-lg font-medium text-slate-800 mb-4">
            Financial Accounts
          </h3>
          <FinancialAccountsSection adminId={businessId} />
        </div>
      )}

      {!isLoading && isClient && business && (
        <div>
          <h3 className="text-lg font-medium text-slate-800 mb-4">
            Integrations
          </h3>
          <IntegrationsSection
            data={
              business as unknown as FragmentType<
                typeof ClientIntegrationsSectionFragmentDoc
              >
            }
          />
        </div>
      )}
    </div>
  );
}
