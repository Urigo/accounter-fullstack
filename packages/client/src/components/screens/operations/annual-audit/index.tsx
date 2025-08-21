import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Calculator, Download, Eye, FileText, Lock, Settings, Upload, Users } from 'lucide-react';
import { useUrlQuery } from '../../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { UserContext } from '../../../../providers/user-provider.js';
import { PageLayout } from '../../../layout/page-layout.js';
import { Button } from '../../../ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.js';
import { Progress } from '../../../ui/progress.js';
import {
  ANNUAL_AUDIT_FLOW_FILTERS_QUERY_PARAM,
  AnnualAuditFlowFilters,
  encodeAnnualAuditFlowFilters,
  type AnnualAuditFlowFilter,
} from './annual-audit-filters.js';
// Import step components
import { Step01ValidateCharges } from './step-01-validate-charges/index.js';
import { Step02LedgerChanges } from './step-02-ledger-changes/index.js';
import Step03OpeningBalance from './step-03-opening-balance/index.js';
import type { StepStatus } from './step-base.js';
import SimpleStep from './step-simple.js';

export function getAnnualAuditFlowHref(filter?: AnnualAuditFlowFilter | null): string {
  const params = new URLSearchParams();

  const annualAuditFlowFilters = encodeAnnualAuditFlowFilters(filter);
  if (annualAuditFlowFilters) {
    // Add it as a single encoded parameter
    params.append(ANNUAL_AUDIT_FLOW_FILTERS_QUERY_PARAM, annualAuditFlowFilters);
  }

  const queryParams = params.size > 0 ? `?${params}` : '';
  return `/workflows/annual-audit${queryParams}`;
}

export const AnnualAuditFlow = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const { userContext } = useContext(UserContext);
  const { get } = useUrlQuery();
  const initialFilters = useMemo(() => {
    const defaultFilters: AnnualAuditFlowFilter = {
      year: new Date().getFullYear() - 1,
      adminBusinessId: userContext?.context.adminBusinessId,
    };
    const uriFilters = get(ANNUAL_AUDIT_FLOW_FILTERS_QUERY_PARAM);
    if (uriFilters) {
      try {
        return JSON.parse(decodeURIComponent(uriFilters)) as AnnualAuditFlowFilter;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        console.error('Failed to parse filters from URI:', error);
      }
    }
    return defaultFilters;
  }, [userContext?.context.adminBusinessId]);
  const [filter, setFilter] = useState<AnnualAuditFlowFilter>(initialFilters);

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <AnnualAuditFlowFilters filter={filter} setFilter={setFilter} />
      </div>,
    );
  }, [filter, setFiltersContext, setFilter]);

  const totalSteps = 21;
  const YEAR = 2024; // TODO: Example year, should be dynamic

  // Track step statuses to avoid double counting
  const stepStatusesRef = useRef<Map<string, StepStatus>>(new Map());
  const [completedSteps, setCompletedSteps] = useState(0);

  const handleStatusChange = useCallback((stepId: string, status: StepStatus) => {
    const previousStatus = stepStatusesRef.current.get(stepId);

    // Only update if status actually changed
    if (previousStatus !== status) {
      stepStatusesRef.current.set(stepId, status);

      // Recalculate completed steps count
      const completedCount = Array.from(stepStatusesRef.current.values()).filter(
        s => s === 'completed',
      ).length;

      setCompletedSteps(completedCount);
    }
  }, []);

  const progressPercentage = (completedSteps / totalSteps) * 100;

  return (
    <PageLayout
      title="Annual Audit Flow"
      description="Complete audit process for annual financial reporting and compliance"
    >
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Progress Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Completed Steps</span>
                  <span>
                    {completedSteps} of {totalSteps}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {progressPercentage.toFixed(1)}% Complete
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Step 1 - Custom component with server data */}
          <Step01ValidateCharges
            id="1"
            year={YEAR}
            adminBusinessId={userContext?.context.adminBusinessId}
            title="Validate All Charges"
            description="Ensure all charges of the year were reviewed, handle pending charges"
            onStatusChange={handleStatusChange}
          />

          {/* Step 2 - Custom component with server data */}
          <Step02LedgerChanges
            id="2"
            year={YEAR}
            adminBusinessId={userContext?.context.adminBusinessId}
            title="Check Pending Ledger Changes"
            description="Ensure no pending ledger changes exist"
            onStatusChange={handleStatusChange}
          />

          {/* Step 3 - Custom component with substeps */}
          <Step03OpeningBalance
            id="3"
            year={YEAR}
            adminBusinessId={userContext?.context.adminBusinessId}
            title="Verify Opening Balance"
            description="Handle opening balance verification based on user type"
            onStatusChange={handleStatusChange}
          />

          {/* Step 4 - Simple step with static data */}
          <SimpleStep
            id="4"
            title="Generate Financial Charges"
            description="Create various financial charges and reserves"
            icon={<Calculator className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[
              { label: 'Calculate Vacation Reserves', href: '/reserves/vacation' },
              { label: 'Calculate Recovery Reserves', href: '/reserves/recovery' },
              { label: 'Process Bank Deposits', href: '/deposits/bank' },
              { label: 'Perform Revaluation', href: '/revaluation' },
              { label: 'Calculate Tax Expenses', href: '/tax/expenses' },
              { label: 'Calculate Depreciation', href: '/depreciation/calculate' },
            ]}
          />

          {/* Step 5 - Simple step */}
          <SimpleStep
            id="5"
            title="Audit Main Process"
            description="Task management system for comprehensive audit checks"
            icon={<FileText className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[
              { label: 'Manage Conto Tree', href: '/conto/tree' },
              { label: 'Open Checklist', href: '/validations/checklist' },
              { label: 'Compare VAT', href: '/vat/comparison' },
              { label: 'Generate Draft', href: '/depreciation/draft' },
              { label: 'Manage Audit Checks', href: '/audit/checks' },
              { label: 'Review Tax Report', href: '/tax/review' },
              { label: 'Cash Flow Analysis', href: '/cashflow/analysis' },
            ]}
          />

          {/* Steps 6-21 - Simple steps with basic configuration */}
          <SimpleStep
            id="6"
            title="Add Shareholders Data (1214)"
            description="For 1214 report preparation"
            icon={<Users className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[
              { label: 'Manage Shareholders', href: '/shareholders/manage' },
              { label: 'Import Data', href: '/shareholders/import' },
            ]}
          />

          <SimpleStep
            id="7"
            title="Revalidate Pending Items"
            description="Ensure no charges approval or ledger regeneration pending"
            icon={<Eye className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[
              { label: 'Check Pending Approvals', href: '/approvals/pending' },
              { label: 'Ledger Status', href: '/ledger/status' },
            ]}
          />

          <SimpleStep
            id="8"
            title="Lock Ledger"
            description="Lock ledger by records and by date"
            icon={<Lock className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[
              { label: 'Lock by Records', href: '/ledger/lock-records' },
              { label: 'Lock by Date', href: '/ledger/lock-date' },
            ]}
          />

          <SimpleStep
            id="9"
            title="Save Final Dynamic Report Template"
            icon={<FileText className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[{ label: 'Save Template', href: '/reports/save-template' }]}
          />

          <SimpleStep
            id="10"
            title="Export Year-end Trial Balance"
            description="For future validations"
            icon={<Download className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[{ label: 'Export Trial Balance', href: '/export/trial-balance' }]}
          />

          <SimpleStep
            id="11"
            title="Generate Final Depreciation Report"
            icon={<FileText className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[{ label: 'Generate Report', href: '/depreciation/final' }]}
          />

          <SimpleStep
            id="12"
            title="Generate Financial Reports"
            description="With comparison numbers from last year"
            icon={<FileText className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[{ label: 'Generate Reports', href: '/reports/financial' }]}
          />

          <SimpleStep
            id="13"
            title="Generate Tax Report"
            icon={<FileText className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[{ label: 'Generate Tax Report', href: '/tax/generate' }]}
          />

          <SimpleStep
            id="14"
            title="Generate Tax Compliance Reports"
            description="For Yossi's review"
            icon={<FileText className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[{ label: 'Generate Report', href: '/compliance/clients-country' }]}
          />

          <SimpleStep
            id="15"
            title="Generate Tax Compliance Report"
            icon={<FileText className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[
              { label: 'Generate 973', href: '/reports/973' },
              { label: 'Generate 901א', href: '/reports/901a' },
            ]}
          />

          <SimpleStep
            id="16"
            title="Generate 6111 Report"
            icon={<FileText className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[{ label: 'Generate 6111', href: '/reports/6111' }]}
          />

          <SimpleStep
            id="17"
            title="Generate Dividend Report 1214ב"
            icon={<FileText className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[{ label: 'Generate Dividend Report', href: '/reports/dividend-1214b' }]}
          />

          <SimpleStep
            id="18"
            title="Generate 1214 Report"
            icon={<FileText className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[{ label: 'Generate 1214', href: '/reports/1214' }]}
          />

          <SimpleStep
            id="19"
            title="Compare Tax Expenses"
            description="Compare 1214 tax expenses with ledger tax expenses"
            icon={<Calculator className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[{ label: 'Compare Expenses', href: '/tax/compare-expenses' }]}
          />

          <SimpleStep
            id="20"
            title="Signing Process"
            description="Handle signing process and accompanying documents"
            icon={<FileText className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[
              { label: 'Prepare Documents', href: '/signing/prepare' },
              { label: 'Digital Signing', href: '/signing/digital' },
            ]}
          />

          <SimpleStep
            id="21"
            title="File Annual Report"
            description="Submit annual report to companies government office"
            icon={<Upload className="h-4 w-4" />}
            onStatusChange={handleStatusChange}
            actions={[
              { label: 'Prepare Filing', href: '/filing/prepare' },
              { label: 'Submit Report', href: '/filing/submit' },
            ]}
          />
        </div>

        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Progress Report
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configure Workflow
            </Button>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View All Reports
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};
