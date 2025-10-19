import type { ReactElement } from 'react';
import {
  Building2,
  //   DollarSign,
  //   FileCheck,
  //   FileText,
  //   Plug,
  Settings,
  //   TrendingUp,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import { BusinessPageFragmentDoc } from '../../gql/graphql.js';
import { BusinessHeader } from './business-header.js';
import { ChargesSection } from './charges-section.jsx';
import { ChartsSection } from './charts-section.jsx';
import { ConfigurationsSection } from './configurations-section.jsx';
import { ContactInfoSection } from './contact-info-section.jsx';
import { ContractsSection } from './contracts-section.jsx';
import { DocumentsSection } from './documents-section.jsx';
import { IntegrationsSection } from './integrations-section.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessPage on Business {
    id
    ...BusinessHeader
    ...BusinessContactSection
    ...BusinessConfigurationSection
  }
`;

interface Props {
  data?: FragmentType<typeof BusinessPageFragmentDoc>;
  refetchBusiness?: () => Promise<void>;
}

export default function Business({ data, refetchBusiness }: Props): ReactElement {
  const business = getFragmentData(BusinessPageFragmentDoc, data);
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') || 'contact';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  if (!business) {
    return <div>Business not found</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <BusinessHeader data={business} />

      <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8 max-w-7xl">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-7 mb-6 h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger
              value="contact"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Contact</span>
            </TabsTrigger>
            <TabsTrigger
              value="config"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            {/* <TabsTrigger
              value="charges"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Charges</span>
            </TabsTrigger> */}
            {/* <TabsTrigger
              value="documents"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documents</span>
            </TabsTrigger> */}
            {/* <TabsTrigger
              value="contracts"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <FileCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Contracts</span>
            </TabsTrigger> */}
            {/* <TabsTrigger
              value="integrations"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger> */}
            {/* <TabsTrigger
              value="charts"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Charts</span>
            </TabsTrigger> */}
          </TabsList>

          <TabsContent value="contact" className="mt-0">
            <ContactInfoSection data={business} refetchBusiness={refetchBusiness} />
          </TabsContent>

          <TabsContent value="config" className="mt-0">
            <ConfigurationsSection data={business} refetchBusiness={refetchBusiness} />
          </TabsContent>

          <TabsContent value="charges" className="mt-0">
            <ChargesSection />
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <DocumentsSection />
          </TabsContent>

          <TabsContent value="contracts" className="mt-0">
            <ContractsSection />
          </TabsContent>

          <TabsContent value="integrations" className="mt-0">
            <IntegrationsSection />
          </TabsContent>

          <TabsContent value="charts" className="mt-0">
            <ChartsSection />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
