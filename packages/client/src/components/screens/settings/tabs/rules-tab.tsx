import { type JSX } from 'react';
import { Loader2 } from 'lucide-react';
import { useOwnerBusiness } from '../../../../hooks/use-owner-business.js';
import { ConfigurationsSection } from '../../../business/configurations-section.jsx';

export function RulesTab(): JSX.Element {
  const { business, isLoading, error, refetch } = useOwnerBusiness();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500">Failed to load configuration</p>;
  }

  if (!business) {
    return (
      <p className="text-sm text-slate-500">
        No business configuration available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-slate-800">
          Rules and Matching
        </h3>
        <p className="text-sm text-slate-500">
          Auto-matching phrases, email rules, and business behavior
        </p>
      </div>
      <ConfigurationsSection data={business} refetchBusiness={refetch} />
    </div>
  );
}
