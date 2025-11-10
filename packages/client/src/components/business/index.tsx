import { useContext, useEffect, type ReactElement } from 'react';
import {
  ArrowLeftRight,
  Building2,
  ChartLine,
  DollarSign,
  FileCheck,
  FileText,
  Notebook,
  Plug,
  Settings,
  Shield,
  Wallet,
  //   TrendingUp,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import { FiltersContext } from '@/providers/filters-context.js';
import { BusinessPageFragmentDoc } from '../../gql/graphql.js';
import { AdminBusinessSection } from './admin-business-section.js';
import { BalanceSection } from './balance-section.js';
import { BusinessHeader } from './business-header.js';
import { ChargesSection } from './charges-section.jsx';
import { ChartsSection } from './charts-section.jsx';
import { ConfigurationsSection } from './configurations-section.jsx';
import { ContactInfoSection } from './contact-info-section.jsx';
import { ContractsSection } from './contracts-section.jsx';
import { DocumentsSection } from './documents-section.jsx';
import { FinancialAccountsSection } from './financial-account-section.js';
import { IntegrationsSection } from './integrations-section.jsx';
import { LedgerSection } from './ledger-section.js';
import { TransactionsSection } from './transactions-section.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessPage on Business {
    id
    ... on LtdFinancialEntity {
      clientInfo {
        id
      }
      adminInfo {
        id
      }
    }
    ...ClientIntegrationsSection
    ...BusinessHeader
    ...BusinessContactSection
    ...BusinessConfigurationSection
    ...BusinessAdminSection
  }
`;

interface Props {
  data?: FragmentType<typeof BusinessPageFragmentDoc>;
  refetchBusiness?: () => Promise<void>;
}

export default function Business({ data, refetchBusiness }: Props): ReactElement {
  const business = getFragmentData(BusinessPageFragmentDoc, data);
  const [searchParams, setSearchParams] = useSearchParams();
  const { setFiltersContext } = useContext(FiltersContext);

  useEffect(() => {
    setFiltersContext(null);
  }, [setFiltersContext]);

  const activeTab = searchParams.get('tab') || 'contact';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  if (!business) {
    return <div>Business not found</div>;
  }

  const isClient = 'clientInfo' in business && !!business.clientInfo;
  const isAdmin = 'adminInfo' in business && !!business.adminInfo;

  return (
    <div className="min-h-screen bg-background">
      <BusinessHeader data={business} />

      <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8 max-w-7xl">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full lg:grid-cols-8 sm:grid-cols-4 grid-cols-8 mb-6 h-auto gap-1 bg-muted/50 p-1">
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
            <TabsTrigger
              value="charges"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Charges</span>
            </TabsTrigger>
            <TabsTrigger
              value="transactions"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span className="hidden sm:inline">Transactions</span>
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documents</span>
            </TabsTrigger>
            <TabsTrigger
              value="ledger"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <Notebook className="h-4 w-4" />
              <span className="hidden sm:inline">Ledger</span>
            </TabsTrigger>
            <TabsTrigger
              value="balance"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <ChartLine className="h-4 w-4" />
              <span className="hidden sm:inline">Balance</span>
            </TabsTrigger>
            {isClient && (
              <>
                <TabsTrigger
                  value="contracts"
                  className="flex items-center gap-2 data-[state=active]:bg-background"
                >
                  <FileCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Contracts</span>
                </TabsTrigger>
                <TabsTrigger
                  value="integrations"
                  className="flex items-center gap-2 data-[state=active]:bg-background"
                >
                  <Plug className="h-4 w-4" />
                  <span className="hidden sm:inline">Integrations</span>
                </TabsTrigger>
                {/* <TabsTrigger
                  value="charts"
                  className="flex items-center gap-2 data-[state=active]:bg-background"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Charts</span>
                </TabsTrigger> */}
              </>
            )}
            {isAdmin && (
              <>
                <TabsTrigger
                  value="accounts"
                  className="flex items-center gap-2 data-[state=active]:bg-background"
                >
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">Accounts</span>
                </TabsTrigger>
                <TabsTrigger
                  value="admin"
                  className="flex items-center gap-2 data-[state=active]:bg-background"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="contact" className="mt-0">
            <ContactInfoSection data={business} refetchBusiness={refetchBusiness} />
          </TabsContent>

          <TabsContent value="config" className="mt-0">
            <ConfigurationsSection data={business} refetchBusiness={refetchBusiness} />
          </TabsContent>

          <TabsContent value="charges" className="mt-0">
            <ChargesSection businessId={business.id} />
          </TabsContent>

          <TabsContent value="transactions" className="mt-0">
            <TransactionsSection businessId={business.id} />
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <DocumentsSection businessId={business.id} />
          </TabsContent>

          <TabsContent value="ledger" className="mt-0">
            <LedgerSection businessId={business.id} />
          </TabsContent>

          <TabsContent value="balance" className="mt-0">
            <BalanceSection businessId={business.id} />
          </TabsContent>

          {isClient && (
            <>
              <TabsContent value="contracts" className="mt-0">
                <ContractsSection clientId={business.id} />
              </TabsContent>

              <TabsContent value="integrations" className="mt-0">
                <IntegrationsSection data={business} />
              </TabsContent>

              <TabsContent value="charts" className="mt-0">
                <ChartsSection />
              </TabsContent>
            </>
          )}

          {isAdmin && (
            <>
              <TabsContent value="accounts" className="mt-0">
                <FinancialAccountsSection adminId={business.id} />
              </TabsContent>
              <TabsContent value="admin" className="mt-0">
                <AdminBusinessSection data={business} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
}
