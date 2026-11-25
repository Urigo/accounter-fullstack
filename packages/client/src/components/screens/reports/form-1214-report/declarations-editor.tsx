import { useMemo, type ReactElement } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TimelessDateString } from '../../../../helpers/index.js';
import { useUpdateReport1214Profile } from '../../../../hooks/use-update-report-1214-profile.js';
import { DatePickerInput } from '../../../common/index.js';
import { Button } from '../../../ui/button.js';
import { Checkbox } from '../../../ui/checkbox.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form.js';
import { Input } from '../../../ui/input.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import { Separator } from '../../../ui/separator.js';
import {
  EditorActions,
  TextField,
  TriStateControl,
  UNSET_OPTION,
  useResetAfterSave,
} from './profile-editor-parts.js';
import {
  CONSOLIDATED_REPORT_OPTIONS,
  declarationsFormSchema,
  declarationsFormToInput,
  declarationsToForm,
  FORM_1214_MAX_REPORTABLE_POSITIONS,
  FORM_6111_OBLIGATION_OPTIONS,
  OPTIONAL_FLAG_DECLARATIONS,
  OPTIONAL_YES_NO_DECLARATIONS,
  reportablePositionsFromForm,
  REQUIRED_DECLARATIONS,
  type DeclarationsFormState,
  type DeclarationsValue,
  type TriState,
} from './profile-forms.js';
import { useForm1214Report } from './report-context.js';

type DeclarationItem = {
  key: string;
  field: string;
  label: string;
  labelHe: string;
};

function DeclarationLabel({ item }: { item: DeclarationItem }): ReactElement {
  return (
    <span className="flex flex-col">
      <span>
        {item.label} <span className="text-muted-foreground">({item.field})</span>
      </span>
      <span dir="rtl" lang="he" className="text-xs text-muted-foreground">
        {item.labelHe}
      </span>
    </span>
  );
}

function TriStateRow({
  control,
  item,
}: {
  control: Control<DeclarationsFormState>;
  item: DeclarationItem;
}): ReactElement {
  return (
    <FormField
      control={control}
      name={`answers.${item.key}`}
      render={({ field }): ReactElement => (
        <FormItem className="flex flex-row flex-wrap items-center justify-between gap-2 py-1">
          <FormLabel className="font-normal">
            <DeclarationLabel item={item} />
          </FormLabel>
          <FormControl>
            <TriStateControl
              label={item.label}
              value={(field.value ?? '') as TriState}
              onChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

function FlagRow({
  control,
  item,
}: {
  control: Control<DeclarationsFormState>;
  item: DeclarationItem;
}): ReactElement {
  return (
    <FormField
      control={control}
      name={`flags.${item.key}`}
      render={({ field }): ReactElement => (
        <FormItem className="flex flex-row items-start gap-3 py-1">
          <FormControl>
            <Checkbox
              checked={!!field.value}
              onCheckedChange={checked => field.onChange(checked === true)}
            />
          </FormControl>
          <FormLabel className="font-normal">
            <DeclarationLabel item={item} />
          </FormLabel>
        </FormItem>
      )}
    />
  );
}

/** A checkbox that reveals the details of a nested declaration while it is checked. */
function ToggleField({
  control,
  name,
  item,
}: {
  control: Control<DeclarationsFormState>;
  name: 'isFamilyCompany' | 'isBeneficiaryEnterprise' | 'isSpecialYear';
  item: DeclarationItem;
}): ReactElement {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }): ReactElement => (
        <FormItem className="flex flex-row items-start gap-3 py-1">
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={checked => field.onChange(checked === true)}
            />
          </FormControl>
          <FormLabel className="font-normal">
            <DeclarationLabel item={item} />
          </FormLabel>
        </FormItem>
      )}
    />
  );
}

function DateField({
  control,
  name,
  label,
}: {
  control: Control<DeclarationsFormState>;
  name: 'beneficiaryNoticeDate' | 'specialYearBalanceSheetDate';
  label: string;
}): ReactElement {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }): ReactElement => (
        <FormItem className="ml-7 max-w-xs">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <DatePickerInput
              value={(field.value || undefined) as TimelessDateString | undefined}
              onChange={date => field.onChange(date ?? '')}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function EnumSelect({
  control,
  name,
  label,
  options,
}: {
  control: Control<DeclarationsFormState>;
  name: 'form6111Obligation' | 'consolidatedReport';
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}): ReactElement {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }): ReactElement => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value || UNSET_OPTION}
            onValueChange={value => field.onChange(value === UNSET_OPTION ? '' : value)}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={UNSET_OPTION}>Not answered</SelectItem>
              {options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ReportablePositions({
  control,
}: {
  control: Control<DeclarationsFormState>;
}): ReactElement {
  const { fields, append, remove } = useFieldArray({ control, name: 'reportablePositions' });
  const positions = useWatch({ control, name: 'reportablePositions' });
  const count = reportablePositionsFromForm(positions ?? []).length;
  return (
    <div className="space-y-2">
      <div>
        <span className="text-sm font-medium">Reportable positions (1034-1046)</span>
        <p className="text-sm text-muted-foreground">
          Position numbers from form 1346, 1 to 999 each.
        </p>
      </div>
      {fields.map((item, index) => (
        <FormField
          key={item.id}
          control={control}
          name={`reportablePositions.${index}.value`}
          render={({ field }): ReactElement => (
            <FormItem>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    {...field}
                    className="w-28"
                    inputMode="numeric"
                    aria-label={`Reportable position ${index + 1}`}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove reportable position ${index + 1}`}
                  onClick={(): void => remove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
      {count > FORM_1214_MAX_REPORTABLE_POSITIONS && (
        <p className="text-sm text-amber-600">
          The form has room for {FORM_1214_MAX_REPORTABLE_POSITIONS} positions; the report
          validation will flag the extra ones.
        </p>
      )}
      <Button type="button" variant="outline" size="sm" onClick={(): void => append({ value: '' })}>
        <Plus className="size-4" />
        Add position
      </Button>
    </div>
  );
}

const FAMILY_COMPANY = {
  key: 'familyCompany',
  field: '836',
  label: 'Family company',
  labelHe: 'סימון החברה חברה משפחתית',
};
const BENEFICIARY_ENTERPRISE = {
  key: 'beneficiaryEnterprise',
  field: '851',
  label: 'Beneficiary enterprise',
  labelHe: 'סימון במפעל מוטב',
};
const SPECIAL_YEAR = {
  key: 'specialYear',
  field: '863',
  label: 'Special (non-calendar) tax year',
  labelHe: 'סימון שנה מיוחדת',
};

/**
 * The declarations of record 1000: the 7 required yes/no answers, then the optional ones. Saves the
 * whole `declarations` block.
 */
export function Form1214DeclarationsEditor({
  declarations,
}: {
  declarations: DeclarationsValue | null | undefined;
}): ReactElement {
  const { year, refresh } = useForm1214Report();
  const defaults = useMemo(() => declarationsToForm(declarations), [declarations]);
  const form = useForm<DeclarationsFormState>({
    resolver: zodResolver(declarationsFormSchema),
    defaultValues: defaults,
  });
  const { markSaved, cancel } = useResetAfterSave(form, defaults);
  const { updateReport1214Profile, fetching, errorMessage } = useUpdateReport1214Profile();

  const { control } = form;
  const [isFamilyCompany, isBeneficiaryEnterprise, isSpecialYear] = useWatch({
    control,
    name: ['isFamilyCompany', 'isBeneficiaryEnterprise', 'isSpecialYear'],
  });

  const onSubmit = async (values: DeclarationsFormState): Promise<void> => {
    const saved = await updateReport1214Profile({
      year,
      input: { declarations: declarationsFormToInput(values) },
      blockName: 'declarations',
    });
    if (saved) {
      markSaved(values);
      refresh();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <h3 className="font-semibold">Required declarations</h3>
          <p className="text-sm text-muted-foreground">
            The report needs an answer to each of these.
          </p>
        </div>
        <div className="divide-y">
          {REQUIRED_DECLARATIONS.map(item => (
            <TriStateRow key={item.key} control={control} item={item} />
          ))}
        </div>

        <Separator />
        <h3 className="font-semibold">Optional declarations</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <EnumSelect
            control={control}
            name="form6111Obligation"
            label="Form 6111 obligation (834)"
            options={FORM_6111_OBLIGATION_OPTIONS}
          />
          <EnumSelect
            control={control}
            name="consolidatedReport"
            label="Consolidated report (875)"
            options={CONSOLIDATED_REPORT_OPTIONS}
          />
        </div>
        <div className="divide-y">
          {OPTIONAL_YES_NO_DECLARATIONS.map(item => (
            <TriStateRow key={item.key} control={control} item={item} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
          {OPTIONAL_FLAG_DECLARATIONS.map(item => (
            <FlagRow key={item.key} control={control} item={item} />
          ))}
        </div>

        <div className="space-y-2">
          <ToggleField control={control} name="isFamilyCompany" item={FAMILY_COMPANY} />
          {isFamilyCompany && (
            <TextField
              control={control}
              name="representativeFileNumber"
              label="Representative's file number (837)"
              placeholder="Up to 9 digits"
              inputMode="numeric"
              className="ml-7 max-w-xs"
            />
          )}
          <ToggleField
            control={control}
            name="isBeneficiaryEnterprise"
            item={BENEFICIARY_ENTERPRISE}
          />
          {isBeneficiaryEnterprise && (
            <DateField control={control} name="beneficiaryNoticeDate" label="Notice date (852)" />
          )}
          <ToggleField control={control} name="isSpecialYear" item={SPECIAL_YEAR} />
          {isSpecialYear && (
            <DateField
              control={control}
              name="specialYearBalanceSheetDate"
              label="Balance sheet date (864)"
            />
          )}
        </div>

        <ReportablePositions control={control} />

        <EditorActions
          isDirty={form.formState.isDirty}
          saving={fetching}
          errorMessage={errorMessage}
          onCancel={cancel}
        />
      </form>
    </Form>
  );
}
