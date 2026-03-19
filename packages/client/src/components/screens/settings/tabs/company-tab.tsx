import { type JSX } from 'react';
import { Loader2 } from 'lucide-react';
import { useOwnerBusiness } from '../../../../hooks/use-owner-business.js';
import { ContactInfoSection } from '../../../business/contact-info-section.jsx';
import { CompanyProfile } from '../company-profile.js';

export function CompanyTab(): JSX.Element {
  const { business, isLoading, error, refetch } = useOwnerBusiness();

  return (
    <div className="space-y-8">
      <CompanyProfile />

      <div>
        <h3 className="text-lg font-medium text-slate-800 mb-4">
          Business Contact Details
        </h3>
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        )}
        {error && (
          <p className="text-sm text-red-500">Failed to load contact details</p>
        )}
        {business && !isLoading && (
          <ContactInfoSection data={business} refetchBusiness={refetch} />
        )}
      </div>
    </div>
  );
}
