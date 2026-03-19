import { type JSX } from 'react';
import { Loader2 } from 'lucide-react';
import { useOwnerBusiness } from '../../../../hooks/use-owner-business.js';
import { AdminBusinessSection } from '../../../business/admin/admin-business-section.jsx';

export function TaxAdminTab(): JSX.Element {
  const { business, isAdmin, isLoading, error, refetch } = useOwnerBusiness();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500">Failed to load tax settings</p>;
  }

  if (!business || !isAdmin) {
    return (
      <p className="text-sm text-slate-500">
        Tax and admin settings are not available for this workspace.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-slate-800">
          Tax and Administration
        </h3>
        <p className="text-sm text-slate-500">
          Withholding tax, tax advances, social security, and registration
        </p>
      </div>
      <AdminBusinessSection data={business} refetchBusiness={refetch} />
    </div>
  );
}
