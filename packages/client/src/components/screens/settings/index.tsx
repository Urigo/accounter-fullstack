import { type JSX } from 'react';
import {
  Building2,
  Calculator,
  DollarSign,
  Shield,
  Users,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useIsAdmin } from '../../../hooks/use-role.js';
import {
  useWorkspaceDisplayName,
  useWorkspaceLogo,
} from '../../../providers/workspace-provider.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs.js';
import { CompanyTab } from './tabs/company-tab.js';
import { FinanceTab } from './tabs/finance-tab.js';
import { RulesTab } from './tabs/rules-tab.js';
import { TaxAdminTab } from './tabs/tax-admin-tab.js';
import { TeamTab } from './tabs/team-tab.js';

type SettingsTab = 'company' | 'rules' | 'tax' | 'preferences' | 'team';

function SettingsHeader(): JSX.Element {
  const companyName = useWorkspaceDisplayName();
  const logoUrl = useWorkspaceLogo();

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg border bg-slate-50 shrink-0">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName}
            className="w-8 h-8 object-contain rounded"
            onError={e => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <Building2 size={20} className="text-slate-400" />
        )}
      </div>
      <div>
        <h2 className="text-2xl font-semibold text-slate-800">Settings</h2>
        <p className="text-sm text-slate-500">
          {companyName} workspace configuration
        </p>
      </div>
    </div>
  );
}

export function SettingsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = useIsAdmin();
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'company';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  const adminTabs = isAdmin
    ? ['company', 'team', 'rules', 'tax', 'preferences']
    : ['company', 'preferences'];

  const visibleTab = adminTabs.includes(activeTab) ? activeTab : 'company';

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <SettingsHeader />

      <Tabs value={visibleTab} onValueChange={handleTabChange}>
        <TabsList
          className="grid w-full"
          style={{ gridTemplateColumns: `repeat(${adminTabs.length}, minmax(0, 1fr))` }}
        >
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 size={14} />
            <span className="hidden sm:inline">Company</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="team" className="gap-1.5">
              <Users size={14} />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="rules" className="gap-1.5">
              <Calculator size={14} />
              <span className="hidden sm:inline">Rules</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="tax" className="gap-1.5">
              <Shield size={14} />
              <span className="hidden sm:inline">Tax</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="preferences" className="gap-1.5">
            <DollarSign size={14} />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-6">
          <CompanyTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="team" className="mt-6">
            <TeamTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="rules" className="mt-6">
            <RulesTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="tax" className="mt-6">
            <TaxAdminTab />
          </TabsContent>
        )}

        <TabsContent value="preferences" className="mt-6">
          <FinanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
