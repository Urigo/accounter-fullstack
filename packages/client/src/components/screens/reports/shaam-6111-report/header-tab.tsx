'use client';

import { AlertTriangle } from 'lucide-react';
import { Fragment } from 'react/jsx-runtime';
import {
  ReportingMethod,
  Shaam6111DataContentHeaderBusinessFragmentDoc,
  Shaam6111DataContentHeaderFragmentDoc,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert.js';
import { TabsContent } from '../../../ui/tabs.js';
import { DataField } from './data-field.js';
import {
  getAccountingMethodText,
  getAccountingSystemText,
  getAuditOpinionTypeText,
  getBusinessTypeText,
  getCurrencyTypeText,
  getIfrsReportingOptionText,
  getReportingMethodText,
} from './header-labels.js';
import { HeaderSettingsDialog } from './header-settings-dialog.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Shaam6111DataContentHeader on Shaam6111Data {
    id
    header {
      taxYear
      businessDescription
      taxFileNumber
      idNumber
      vatFileNumber
      withholdingTaxFileNumber
      businessType
      reportingMethod
      currencyType
      amountsInThousands
      accountingMethod
      accountingSystem
      softwareRegistrationNumber
      isPartnership
      partnershipCount
      partnershipProfitShare
      ifrsImplementationYear
      ifrsReportingOption

      includesProfitLoss
      includesTaxAdjustment
      includesBalanceSheet

      industryCode
      auditOpinionType
    }
  }
`;
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Shaam6111DataContentHeaderBusiness on Business {
    id
    name
  }
`;

const getBooleanText = (value: boolean) => {
  if (value === undefined || value === null) return '';
  return value ? 'כן' : 'לא';
};

type HeaderTabProps = {
  data: FragmentType<typeof Shaam6111DataContentHeaderFragmentDoc>;
  businessInfo: FragmentType<typeof Shaam6111DataContentHeaderBusinessFragmentDoc>;
  businessId: string;
  year: number;
  /** Header warnings (unset fields), from the report validation */
  warnings: string[];
  onSettingsSaved?: () => void;
};

export function HeaderTab({
  data,
  businessInfo,
  businessId,
  year,
  warnings,
  onSettingsSaved,
}: HeaderTabProps) {
  const { header } = getFragmentData(Shaam6111DataContentHeaderFragmentDoc, data);
  const business = getFragmentData(Shaam6111DataContentHeaderBusinessFragmentDoc, businessInfo);
  return (
    <TabsContent value="header" className="border rounded-md p-4">
      <div className="flex justify-end mb-4" dir="rtl">
        <HeaderSettingsDialog
          businessId={businessId}
          year={year}
          initialValues={header}
          onSaved={onSettingsSaved}
        />
      </div>
      {warnings.length > 0 && (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900" dir="ltr">
          <AlertTriangle className="h-4 w-4 text-amber-700!" />
          <AlertTitle>Header fields to set</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map(warning => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" dir="rtl">
        <div className="space-y-4">
          <h3 className="text-lg font-bold border-b pb-2">פרטים מזהים</h3>

          <DataField label="השם הרשום" value={business.name} showEmptyFields />
          <DataField
            label="תיאור העיסוק המדווח"
            value={header.businessDescription ?? ''}
            showEmptyFields
          />
          <DataField label="מספר זהות" value={header.idNumber} showEmptyFields />
          <DataField label="מספר תיק" value={header.taxFileNumber} showEmptyFields />
          <DataField label='תיק מדווח למע"מ' value={header.vatFileNumber ?? ''} showEmptyFields />
          <DataField
            label="מספר תיק ניכויים"
            value={header.withholdingTaxFileNumber ?? ''}
            showEmptyFields
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold border-b pb-2">פרטי העסק</h3>
          <DataField
            value={getBusinessTypeText(header.businessType)}
            label="סוג העסק המדווח"
            showEmptyFields
          />
          <DataField
            label="שיטת דיווח"
            value={getReportingMethodText(header.reportingMethod)}
            showEmptyFields
          />
          {header.reportingMethod === ReportingMethod.DollarRegulations && (
            <DataField
              label="מטבע הסכומים"
              value={getCurrencyTypeText(header.currencyType)}
              showEmptyFields
            />
          )}
          <DataField
            label="הסכום באלפים"
            value={getBooleanText(header.amountsInThousands)}
            showEmptyFields
          />
          <DataField
            label="שיטת חשבונאות"
            value={getAccountingMethodText(header.accountingMethod)}
            showEmptyFields
          />
          <DataField
            label="הנהלת חשבונות"
            value={getAccountingSystemText(header.accountingSystem)}
            showEmptyFields
          />
          <DataField
            label="חייב ברישום תוכנה"
            value={getBooleanText(!!header.softwareRegistrationNumber)}
            showEmptyFields
          />
          {header.softwareRegistrationNumber && (
            <DataField
              label="מספר תעודת רישום"
              value={header.softwareRegistrationNumber}
              showEmptyFields
            />
          )}
          <DataField
            label="דוח בגין שותפות"
            value={getBooleanText(!!header.isPartnership)}
            showEmptyFields
          />
          {header.isPartnership && (
            <Fragment>
              <DataField
                label="מספר שותפים"
                value={header.partnershipCount?.toString() ?? ''}
                showEmptyFields
              />
              <DataField
                label="חלקי ברווחי השותפות"
                value={`${header.partnershipProfitShare}%`}
                showEmptyFields
              />
            </Fragment>
          )}
          <DataField
            label="יישום תקני חשבונאות (IFRS)"
            value={getBooleanText(!!header.ifrsImplementationYear || !!header.ifrsReportingOption)}
            showEmptyFields
          />
          {(!!header.ifrsImplementationYear || !!header.ifrsReportingOption) && (
            <Fragment>
              <DataField
                label="החל משנת המס"
                value={header.ifrsImplementationYear ?? ''}
                showEmptyFields
              />
              <DataField
                label="דווח בחלופה"
                value={getIfrsReportingOptionText(header.ifrsReportingOption)}
                showEmptyFields
              />
            </Fragment>
          )}
          <DataField label="מספר ענף כלכלי של המדווח" value={header.industryCode} showEmptyFields />
          <DataField
            label="חוות דעת המבקר"
            value={getAuditOpinionTypeText(header.auditOpinionType)}
            showEmptyFields
          />
        </div>
      </div>
    </TabsContent>
  );
}
