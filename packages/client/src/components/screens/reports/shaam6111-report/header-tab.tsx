'use client';

import { Fragment } from 'react/jsx-runtime';
import {
  AccountingMethod,
  AccountingSystem,
  AuditOpinionType,
  CurrencyType,
  IfrsReportingOption,
  ReportingMethod,
  Shaam6111DataContentHeaderBusinessFragmentDoc,
  Shaam6111DataContentHeaderFragmentDoc,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { TabsContent } from '../../../ui/tabs.jsx';
import { DataField } from './data-field.jsx';

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

const getBusinessTypeText = (type: string) => {
  switch (type) {
    case '1':
      return 'תעשייתי';
    case '2':
      return 'מסחרי';
    case '3':
      return 'נותני שירותים';
    case '99':
      return 'הדיווח כולל יותר מעסק אחד';
    default:
      return '';
  }
};

const getReportingMethodText = (method: ReportingMethod) => {
  switch (method) {
    case ReportingMethod.Cash:
      return 'מזומן';
    case ReportingMethod.Accrual:
      return 'מצטבר';
    case ReportingMethod.DollarRegulations:
      return 'לפי תקנות דולריות';
    default:
      return '';
  }
};

const getCurrencyTypeText = (type: CurrencyType) => {
  switch (type) {
    case CurrencyType.Shekels:
      return 'שקלים';
    case CurrencyType.Dollars:
      return 'דולרים';
    default:
      return '';
  }
};

const getAccountingMethodText = (method: AccountingMethod) => {
  switch (method) {
    case AccountingMethod.DoubleEntry:
      return 'כפולה';
    case AccountingMethod.SingleEntry:
      return 'חד-צידית';
    default:
      return '';
  }
};

const getAccountingSystemText = (system: AccountingSystem) => {
  switch (system) {
    case AccountingSystem.Computerized:
      return 'ממוחשב';
    case AccountingSystem.Manual:
      return 'ידני';
    default:
      return '';
  }
};

const getIfrsReportingOptionText = (option?: IfrsReportingOption | null) => {
  switch (option) {
    case IfrsReportingOption.Option_1:
      return 'חלופה 1';
    case IfrsReportingOption.Option_2Adjustments:
      return 'התאמות חשבונאיות למי שיישם את חלופה 2 בהוראת ביצוע 7/2010';
    case IfrsReportingOption.Option_3Adjustments:
      return 'התאמות חשבונאיות למי שיישם את חלופה 3 בהוראת ביצוע 7/2010';
    case IfrsReportingOption.None:
      return 'ללא חלופה';
    default:
      return '';
  }
};

const getAuditOpinionTypeText = (type?: AuditOpinionType | null) => {
  switch (type) {
    case AuditOpinionType.Unqualified:
      return 'נוסח אחיד (בלתי מסוייג)';
    case AuditOpinionType.UnqualifiedWithGoingConcern:
      return 'בנוסח אחיד עם הפניית תשומת לב להערת עסק חי';
    case AuditOpinionType.UnqualifiedWithOtherEmphases:
      return 'בנוסח אחיד עם הפניות תשומת לב אחרת';
    case AuditOpinionType.Qualified:
      return 'הסתייגות';
    case AuditOpinionType.Adverse:
      return 'שלילית';
    case AuditOpinionType.Disclaimer:
      return 'המנעות';
    case AuditOpinionType.None:
      return 'אין חוות דעת';
    default:
      return '';
  }
};

const getBooleanText = (value: boolean) => {
  if (value === undefined || value === null) return '';
  return value ? 'כן' : 'לא';
};

type HeaderTabProps = {
  data: FragmentType<typeof Shaam6111DataContentHeaderFragmentDoc>;
  businessInfo: FragmentType<typeof Shaam6111DataContentHeaderBusinessFragmentDoc>;
};

export function HeaderTab({ data, businessInfo }: HeaderTabProps) {
  const { header } = getFragmentData(Shaam6111DataContentHeaderFragmentDoc, data);
  const business = getFragmentData(Shaam6111DataContentHeaderBusinessFragmentDoc, businessInfo);
  return (
    <TabsContent value="header" className="border rounded-md p-4">
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
