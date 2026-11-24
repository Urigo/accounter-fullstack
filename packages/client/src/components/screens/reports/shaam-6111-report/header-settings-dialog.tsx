'use client';

import { useState, type ReactElement } from 'react';
import { Pencil } from 'lucide-react';
import {
  AccountingMethod,
  AccountingSystem,
  AuditOpinionType,
  BusinessType,
  CurrencyType,
  IfrsReportingOption,
  ReportingMethod,
  type Shaam6111HeaderInput,
} from '../../../../gql/graphql.js';
import { useUpdateShaam6111 } from '../../../../hooks/use-update-shaam6111.js';
import { Button } from '../../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../ui/dialog.js';
import { Input } from '../../../ui/input.js';
import { Label } from '../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import {
  getAccountingMethodText,
  getAccountingSystemText,
  getAuditOpinionTypeText,
  getBusinessTypeText,
  getCurrencyTypeText,
  getIfrsReportingOptionText,
  getReportingMethodText,
} from './header-labels.js';

/** The header values the dialog starts from: what the report currently uses */
export type HeaderSettingsValues = {
  industryCode?: string | null;
  businessDescription?: string | null;
  businessType?: BusinessType | null;
  reportingMethod?: ReportingMethod | null;
  accountingMethod?: AccountingMethod | null;
  accountingSystem?: AccountingSystem | null;
  softwareRegistrationNumber?: string | null;
  isPartnership?: boolean | null;
  partnershipCount?: number | null;
  partnershipProfitShare?: number | null;
  ifrsImplementationYear?: string | null;
  ifrsReportingOption?: IfrsReportingOption | null;
  currencyType?: CurrencyType | null;
  amountsInThousands?: boolean | null;
  auditOpinionType?: AuditOpinionType | null;
};

const booleanText = (value: boolean) => (value ? 'כן' : 'לא');

function EnumField<T extends string>({
  label,
  value,
  options,
  getText,
  onChange,
}: {
  label: string;
  value?: T | null;
  options: readonly T[];
  getText: (value: T) => string;
  onChange: (value: T) => void;
}): ReactElement {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value ?? undefined} onValueChange={value => onChange(value as T)}>
        <SelectTrigger className="w-full" dir="rtl">
          <SelectValue placeholder="לא הוגדר" />
        </SelectTrigger>
        <SelectContent dir="rtl">
          {options.map(option => (
            <SelectItem key={option} value={option}>
              {getText(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value?: string | number | null;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
}): ReactElement {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value ?? ''} onChange={event => onChange(event.target.value)} />
    </div>
  );
}

/** The header input for a set of values: blank text is `null`, which unsets a field */
function toHeaderInput(values: HeaderSettingsValues): Required<Shaam6111HeaderInput> {
  const text = (value?: string | null) => value?.trim() || null;
  return {
    industryCode: text(values.industryCode),
    businessDescription: text(values.businessDescription),
    businessType: values.businessType ?? null,
    reportingMethod: values.reportingMethod ?? null,
    accountingMethod: values.accountingMethod ?? null,
    accountingSystem: values.accountingSystem ?? null,
    softwareRegistrationNumber: text(values.softwareRegistrationNumber),
    isPartnership: values.isPartnership ?? null,
    partnershipCount: values.isPartnership ? (values.partnershipCount ?? null) : null,
    partnershipProfitShare: values.isPartnership ? (values.partnershipProfitShare ?? null) : null,
    ifrsImplementationYear: text(values.ifrsImplementationYear),
    ifrsReportingOption: values.ifrsReportingOption ?? null,
    currencyType: values.currencyType ?? null,
    amountsInThousands: values.amountsInThousands ?? null,
    auditOpinionType: values.auditOpinionType ?? null,
  };
}

const toNumber = (value: string) => (value.trim() === '' ? null : Number.parseInt(value, 10));

/**
 * Edits the 6111 header fields that the books can't supply. They are stored for the report's
 * year; later years use them until changed, except the audit opinion, which is set every year.
 */
export function HeaderSettingsDialog({
  businessId,
  year,
  initialValues,
  onSaved,
}: {
  businessId: string;
  year: number;
  initialValues: HeaderSettingsValues;
  onSaved?: () => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<HeaderSettingsValues>(initialValues);
  const { updateShaam6111, fetching } = useUpdateShaam6111();

  const set = <K extends keyof HeaderSettingsValues>(key: K, value: HeaderSettingsValues[K]) =>
    setValues(previous => ({ ...previous, [key]: value }));

  const onOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setValues(initialValues);
    }
    setOpen(isOpen);
  };

  const onSave = async () => {
    // only the fields the user changed: the dialog starts from the report's effective header
    // (inherited values and defaults), and storing those would pin them to this year
    const initial = toHeaderInput(initialValues);
    const current = toHeaderInput(values);
    const header = Object.fromEntries(
      Object.entries(current).filter(
        ([key, value]) => value !== initial[key as keyof Shaam6111HeaderInput],
      ),
    ) as Shaam6111HeaderInput;
    if (Object.keys(header).length === 0) {
      setOpen(false);
      return;
    }
    const result = await updateShaam6111({ businessId, year, header });
    if (result) {
      setOpen(false);
      onSaved?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          עריכת פרטי הכותרת
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-screen overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>פרטי כותרת 6111 לשנת {year}</DialogTitle>
          <DialogDescription>
            הערכים נשמרים לשנה זו וחלים גם על השנים הבאות עד לשינוי. חוות דעת המבקר נקבעת לכל שנה
            בנפרד.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <TextField
            label="מספר ענף (4 ספרות)"
            value={values.industryCode}
            onChange={value => set('industryCode', value)}
          />
          <TextField
            label="תיאור העסק (עד 50 תווים)"
            value={values.businessDescription}
            onChange={value => set('businessDescription', value)}
          />
          <EnumField
            label="סוג העסק"
            value={values.businessType}
            options={Object.values(BusinessType)}
            getText={getBusinessTypeText}
            onChange={value => set('businessType', value)}
          />
          <EnumField
            label="חוות דעת המבקר"
            value={values.auditOpinionType}
            options={Object.values(AuditOpinionType)}
            getText={getAuditOpinionTypeText}
            onChange={value => set('auditOpinionType', value)}
          />
          <EnumField
            label="שיטת דיווח"
            value={values.reportingMethod}
            options={Object.values(ReportingMethod)}
            getText={getReportingMethodText}
            onChange={value => set('reportingMethod', value)}
          />
          <EnumField
            label="שיטת חשבונאות"
            value={values.accountingMethod}
            options={Object.values(AccountingMethod)}
            getText={getAccountingMethodText}
            onChange={value => set('accountingMethod', value)}
          />
          <EnumField
            label="הנהלת חשבונות"
            value={values.accountingSystem}
            options={Object.values(AccountingSystem)}
            getText={getAccountingSystemText}
            onChange={value => set('accountingSystem', value)}
          />
          <EnumField
            label="מטבע הסכומים"
            value={values.currencyType}
            options={Object.values(CurrencyType)}
            getText={getCurrencyTypeText}
            onChange={value => set('currencyType', value)}
          />
          <EnumField
            label="הסכומים באלפים"
            value={values.amountsInThousands == null ? null : String(values.amountsInThousands)}
            options={['true', 'false']}
            getText={value => booleanText(value === 'true')}
            onChange={value => set('amountsInThousands', value === 'true')}
          />
          <TextField
            label="מספר תעודת רישום תוכנה (99999999 אם אין)"
            value={values.softwareRegistrationNumber}
            onChange={value => set('softwareRegistrationNumber', value)}
          />
          <TextField
            label="שנת יישום תקני חשבונאות (9999 אם אין)"
            value={values.ifrsImplementationYear}
            onChange={value => set('ifrsImplementationYear', value)}
          />
          <EnumField
            label="דיווח בחלופה (IFRS)"
            value={values.ifrsReportingOption}
            options={Object.values(IfrsReportingOption)}
            getText={getIfrsReportingOptionText}
            onChange={value => set('ifrsReportingOption', value)}
          />
          <EnumField
            label="דוח בגין שותפות"
            value={values.isPartnership == null ? null : String(values.isPartnership)}
            options={['true', 'false']}
            getText={value => booleanText(value === 'true')}
            onChange={value => set('isPartnership', value === 'true')}
          />
          {values.isPartnership && (
            <>
              <TextField
                label="מספר שותפים"
                type="number"
                value={values.partnershipCount}
                onChange={value => set('partnershipCount', toNumber(value))}
              />
              <TextField
                label="חלקי ברווחי השותפות"
                type="number"
                value={values.partnershipProfitShare}
                onChange={value => set('partnershipProfitShare', toNumber(value))}
              />
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onSave} disabled={fetching}>
            שמירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
