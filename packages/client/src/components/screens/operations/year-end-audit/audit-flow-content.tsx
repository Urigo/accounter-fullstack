import { useState } from 'react';
import { Calculator, Download, Eye, FileText, Lock, Settings, Upload, Users } from 'lucide-react';
import { Button } from '../../../ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.jsx';
import { Progress } from '../../../ui/progress.jsx';
import { AuditStep, AuditStepInfo } from './audit-step.js';
import { ValidateChargesStep } from './validate-charges/validate-charges.js';

export function AuditFlowContent() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (stepId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSections(newExpanded);
  };

  const auditSteps: AuditStepInfo[] = [
    ValidateChargesStep(),
    {
      id: '2',
      title: 'Check Pending Ledger Changes',
      description: 'Ensure no pending ledger changes exist',
      status: 'in-progress',
      icon: <Settings className="h-4 w-4" />,
      actions: [
        { label: 'View Ledger Status', href: '/ledger/status' },
        { label: 'Resolve Pending Changes', href: '/ledger/pending' },
      ],
    },
    {
      id: '3',
      title: 'Verify Opening Balance',
      description: 'Handle opening balance verification based on user type',
      status: 'pending',
      icon: <Calculator className="h-4 w-4" />,
      substeps: [
        {
          id: '3a',
          title: 'New Users',
          description: 'Not relevant for new users',
          status: 'completed',
          actions: [{ label: 'Mark as N/A', onClick: () => {} }],
        },
        {
          id: '3b',
          title: 'Migrating Users',
          description: 'Create balance charge and dynamic report',
          status: 'pending',
          actions: [
            { label: 'Create Balance Charge', href: '/balance/create' },
            { label: 'Generate Dynamic Report', href: '/reports/dynamic' },
            { label: 'Upload Conto 331 Report', href: '/upload/conto331' },
          ],
        },
        {
          id: '3c',
          title: 'Continuing Users',
          description: 'Compare with previous year final trial balance',
          status: 'pending',
          actions: [
            { label: 'Compare Trial Balance', href: '/balance/compare' },
            { label: 'View Previous Year', href: '/reports/previous-year' },
          ],
        },
      ],
    },
    {
      id: '4',
      title: 'Generate Financial Charges',
      description: 'Create various financial charges and reserves',
      status: 'pending',
      icon: <Calculator className="h-4 w-4" />,
      substeps: [
        {
          id: '4a',
          title: 'Vacation Reserves',
          status: 'pending',
          actions: [{ label: 'Calculate Reserves', href: '/reserves/vacation' }],
        },
        {
          id: '4b',
          title: 'Recovery Reserves',
          status: 'pending',
          actions: [{ label: 'Calculate Reserves', href: '/reserves/recovery' }],
        },
        {
          id: '4c',
          title: 'Bank Deposits',
          status: 'pending',
          actions: [{ label: 'Process Deposits', href: '/deposits/bank' }],
        },
        {
          id: '4d',
          title: 'Revaluation',
          status: 'pending',
          actions: [{ label: 'Perform Revaluation', href: '/revaluation' }],
        },
        {
          id: '4e',
          title: 'Tax Expenses',
          status: 'pending',
          actions: [{ label: 'Calculate Tax Expenses', href: '/tax/expenses' }],
        },
        {
          id: '4f',
          title: 'Depreciation',
          status: 'pending',
          actions: [{ label: 'Calculate Depreciation', href: '/depreciation/calculate' }],
        },
      ],
    },
    {
      id: '5',
      title: 'Audit Main Process',
      description: 'Task management system for comprehensive audit checks',
      status: 'pending',
      icon: <FileText className="h-4 w-4" />,
      substeps: [
        {
          id: '5a',
          title: 'Review Conto Tree',
          description: 'Organize accounts and add audit checks',
          status: 'pending',
          actions: [{ label: 'Manage Conto Tree', href: '/conto/tree' }],
        },
        {
          id: '5b',
          title: 'General Validations',
          description: 'Checklist and docs based on dynamic report',
          status: 'pending',
          actions: [{ label: 'Open Checklist', href: '/validations/checklist' }],
        },
        {
          id: '5c',
          title: 'VAT Comparison UI',
          status: 'pending',
          actions: [{ label: 'Compare VAT', href: '/vat/comparison' }],
        },
        {
          id: '5d',
          title: 'Generate Depreciation Report (Draft)',
          status: 'pending',
          actions: [{ label: 'Generate Draft', href: '/depreciation/draft' }],
        },
        {
          id: '5e',
          title: 'Audit Checks',
          description: 'Balance reports, agreements review, etc.',
          status: 'pending',
          actions: [{ label: 'Manage Audit Checks', href: '/audit/checks' }],
        },
        {
          id: '5f',
          title: 'Review Tax Report',
          description: 'After P&L review, validate tax expenses',
          status: 'pending',
          actions: [{ label: 'Review Tax Report', href: '/tax/review' }],
        },
        {
          id: '5g',
          title: 'Analyze Cash Flow',
          status: 'pending',
          actions: [{ label: 'Cash Flow Analysis', href: '/cashflow/analysis' }],
        },
      ],
    },
    {
      id: '6',
      title: 'Add Shareholders Data (1214)',
      description: 'For 1214 report preparation',
      status: 'pending',
      icon: <Users className="h-4 w-4" />,
      actions: [
        { label: 'Manage Shareholders', href: '/shareholders/manage' },
        { label: 'Import Data', href: '/shareholders/import' },
      ],
    },
    {
      id: '7',
      title: 'Revalidate Pending Items',
      description: 'Ensure no charges approval or ledger regeneration pending',
      status: 'pending',
      icon: <Eye className="h-4 w-4" />,
      actions: [
        { label: 'Check Pending Approvals', href: '/approvals/pending' },
        { label: 'Ledger Status', href: '/ledger/status' },
      ],
    },
    {
      id: '8',
      title: 'Lock Ledger',
      description: 'Lock ledger by records and by date',
      status: 'pending',
      icon: <Lock className="h-4 w-4" />,
      actions: [
        { label: 'Lock by Records', href: '/ledger/lock-records' },
        { label: 'Lock by Date', href: '/ledger/lock-date' },
      ],
    },
    {
      id: '9',
      title: 'Save Final Dynamic Report Template',
      status: 'pending',
      icon: <FileText className="h-4 w-4" />,
      actions: [{ label: 'Save Template', href: '/reports/save-template' }],
    },
    {
      id: '10',
      title: 'Export Year-end Trial Balance',
      description: 'For future validations',
      status: 'pending',
      icon: <Download className="h-4 w-4" />,
      actions: [{ label: 'Export Trial Balance', href: '/export/trial-balance' }],
    },
    {
      id: '11',
      title: 'Generate Final Depreciation Report',
      status: 'pending',
      icon: <FileText className="h-4 w-4" />,
      actions: [{ label: 'Generate Report', href: '/depreciation/final' }],
    },
    {
      id: '12',
      title: 'Generate Financial Reports',
      description: 'With comparison numbers from last year',
      status: 'pending',
      icon: <FileText className="h-4 w-4" />,
      actions: [{ label: 'Generate Reports', href: '/reports/financial' }],
    },
    {
      id: '13',
      title: 'Generate Tax Report',
      status: 'pending',
      icon: <FileText className="h-4 w-4" />,
      actions: [{ label: 'Generate Tax Report', href: '/tax/generate' }],
    },
    {
      id: '14',
      title: 'Generate Tax Compliance Reports',
      description: "For Yossi's review",
      status: 'pending',
      icon: <FileText className="h-4 w-4" />,
      substeps: [
        {
          id: '14a',
          title: 'Clients by Country',
          status: 'pending',
          actions: [{ label: 'Generate Report', href: '/compliance/clients-country' }],
        },
      ],
    },
    {
      id: '15',
      title: 'Generate Tax Compliance Report',
      status: 'pending',
      icon: <FileText className="h-4 w-4" />,
      substeps: [
        {
          id: '15a',
          title: '973 Report',
          status: 'pending',
          actions: [{ label: 'Generate 973', href: '/reports/973' }],
        },
        {
          id: '15b',
          title: '901א Report',
          status: 'pending',
          actions: [{ label: 'Generate 901א', href: '/reports/901a' }],
        },
      ],
    },
    {
      id: '16',
      title: 'Generate 6111 Report',
      status: 'pending',
      icon: <FileText className="h-4 w-4" />,
      actions: [{ label: 'Generate 6111', href: '/reports/6111' }],
    },
    {
      id: '17',
      title: 'Generate Dividend Report 1214ב',
      status: 'pending',
      icon: <FileText className="h-4 w-4" />,
      actions: [{ label: 'Generate Dividend Report', href: '/reports/dividend-1214b' }],
    },
    {
      id: '18',
      title: 'Generate 1214 Report',
      status: 'pending',
      icon: <FileText className="h-4 w-4" />,
      actions: [{ label: 'Generate 1214', href: '/reports/1214' }],
    },
    {
      id: '19',
      title: 'Compare Tax Expenses',
      description: 'Compare 1214 tax expenses with ledger tax expenses',
      status: 'pending',
      icon: <Calculator className="h-4 w-4" />,
      actions: [{ label: 'Compare Expenses', href: '/tax/compare-expenses' }],
    },
    {
      id: '20',
      title: 'Signing Process',
      description: 'Handle signing process and accompanying documents',
      status: 'pending',
      icon: <FileText className="h-4 w-4" />,
      actions: [
        { label: 'Prepare Documents', href: '/signing/prepare' },
        { label: 'Digital Signing', href: '/signing/digital' },
      ],
    },
    {
      id: '21',
      title: 'File Annual Report',
      description: 'Submit annual report to companies government office',
      status: 'pending',
      icon: <Upload className="h-4 w-4" />,
      actions: [
        { label: 'Prepare Filing', href: '/filing/prepare' },
        { label: 'Submit Report', href: '/filing/submit' },
      ],
    },
  ];

  const completedSteps = auditSteps.filter(step => step.status === 'completed').length;
  const totalSteps = auditSteps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  return (
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
        {auditSteps.map((step, i) => (
          <AuditStep
            step={step}
            key={i}
            toggleSection={toggleSection}
            isExpanded={expandedSections.has(step.id)}
          />
        ))}
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
  );
}
