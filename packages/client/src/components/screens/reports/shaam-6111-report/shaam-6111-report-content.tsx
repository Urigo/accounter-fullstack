'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  Shaam6111DataContentFragmentDoc,
  Shaam6111DataContentHeaderBusinessFragmentDoc,
  Shaam6111ValidationIssuesFragmentDoc,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { Button } from '../../../ui/button.js';
import { Tabs, TabsList, TabsTrigger } from '../../../ui/tabs.js';
import { BalanceSheetTab } from './balance-sheet-tab.js';
import { Shaam6111DownloadButton } from './download-button.js';
import { HeaderTab } from './header-tab.js';
import { ProfitAndLossTab } from './profit-and-loss-tab.js';
import { TaxAdjustmentTab } from './tax-adjustment-tab.js';
import { Shaam6111ValidationIssues } from './validation-issues.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Shaam6111DataContent on Shaam6111Data {
    id
    ...Shaam6111DataContentHeader
    ...Shaam6111DataContentProfitLoss
    ...Shaam6111DataContentTaxAdjustment
    ...Shaam6111DataContentBalanceSheet
  }
`;

type Shaam6111ReportContentProps = {
  data: FragmentType<typeof Shaam6111DataContentFragmentDoc>;
  referenceData?: FragmentType<typeof Shaam6111DataContentFragmentDoc>;
  businessInfo: FragmentType<typeof Shaam6111DataContentHeaderBusinessFragmentDoc>;
  validation: FragmentType<typeof Shaam6111ValidationIssuesFragmentDoc>;
  selectedBusiness: string;
  selectedYear: string;
  referenceYear?: string;
  taxAdjustmentOverrides: { code: number; amount: number }[];
  /** Reloads the report after its settings change */
  onSettingsSaved?: () => void;
};

export function Shaam6111ReportContent({
  data,
  referenceData,
  businessInfo,
  validation,
  selectedBusiness,
  selectedYear,
  referenceYear,
  taxAdjustmentOverrides,
  onSettingsSaved,
}: Shaam6111ReportContentProps) {
  const reportData = getFragmentData(Shaam6111DataContentFragmentDoc, data);
  const { isValid, issues } = getFragmentData(Shaam6111ValidationIssuesFragmentDoc, validation);
  const headerWarnings = issues
    .filter(issue => issue.path?.startsWith('header'))
    .map(issue => issue.message);
  const year = Number.parseInt(selectedYear, 10);
  const referenceReportData = getFragmentData(Shaam6111DataContentFragmentDoc, referenceData);
  const [activeTab, setActiveTab] = useState('header');
  const [showEmptyFields, setShowEmptyFields] = useState(true);

  return (
    <div className="p-4 border-gray-300" dir="rtl">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={showEmptyFields ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowEmptyFields(!showEmptyFields)}
              className="flex items-center gap-2"
            >
              {showEmptyFields ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showEmptyFields ? 'הסתר שדות ריקים' : 'הצג שדות ריקים'}
            </Button>
            <span className="text-sm text-gray-500">
              {showEmptyFields ? 'מציג את כל השדות' : 'מציג רק שדות עם נתונים'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Shaam6111DownloadButton year={year} businessId={selectedBusiness} disabled={!isValid} />
        </div>
      </div>
      <Shaam6111ValidationIssues validation={validation} />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full" dir="rtl">
          <TabsTrigger value="header">פרטים מזהים</TabsTrigger>
          <TabsTrigger value="profitLoss">רווח והפסד</TabsTrigger>
          <TabsTrigger value="taxAdjustment">התאמה למס</TabsTrigger>
          <TabsTrigger value="balanceSheet">מאזן</TabsTrigger>
        </TabsList>

        <HeaderTab
          data={reportData}
          businessInfo={businessInfo}
          businessId={selectedBusiness}
          year={year}
          warnings={headerWarnings}
          onSettingsSaved={onSettingsSaved}
        />

        <ProfitAndLossTab
          selectedYear={selectedYear}
          referenceYear={referenceYear}
          data={reportData}
          referenceData={referenceReportData}
          showEmptyFields={showEmptyFields}
        />

        <TaxAdjustmentTab
          data={reportData}
          referenceData={referenceReportData}
          showEmptyFields={showEmptyFields}
          businessId={selectedBusiness}
          year={year}
          overrides={taxAdjustmentOverrides}
          onOverridesSaved={onSettingsSaved}
        />

        <BalanceSheetTab
          data={reportData}
          referenceData={referenceReportData}
          showEmptyFields={showEmptyFields}
        />
      </Tabs>
    </div>
  );
}
