import {
  AccountingMethod,
  AccountingSystem,
  AuditOpinionType,
  BusinessType,
  CurrencyType,
  IfrsReportingOption,
  ReportingMethod,
} from '../../../../gql/graphql.js';

export const getBusinessTypeText = (type?: BusinessType | null) => {
  switch (type) {
    case BusinessType.Industrial:
      return 'תעשייתי';
    case BusinessType.Commercial:
      return 'מסחרי';
    case BusinessType.Service:
      return 'נותני שירותים';
    case BusinessType.Multiple:
      return 'הדיווח כולל יותר מעסק אחד';
    case BusinessType.Combination:
      return 'שילוב';
    default:
      return '';
  }
};

export const getReportingMethodText = (method: ReportingMethod) => {
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

export const getCurrencyTypeText = (type: CurrencyType) => {
  switch (type) {
    case CurrencyType.Shekels:
      return 'שקלים';
    case CurrencyType.Dollars:
      return 'דולרים';
    default:
      return '';
  }
};

export const getAccountingMethodText = (method: AccountingMethod) => {
  switch (method) {
    case AccountingMethod.DoubleEntry:
      return 'כפולה';
    case AccountingMethod.SingleEntry:
      return 'חד-צידית';
    default:
      return '';
  }
};

export const getAccountingSystemText = (system: AccountingSystem) => {
  switch (system) {
    case AccountingSystem.Computerized:
      return 'ממוחשב';
    case AccountingSystem.Manual:
      return 'ידני';
    default:
      return '';
  }
};

export const getIfrsReportingOptionText = (option?: IfrsReportingOption | null) => {
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

export const getAuditOpinionTypeText = (type?: AuditOpinionType | null) => {
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
