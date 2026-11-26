import { useMemo, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateReport1214Profile } from '../../../../hooks/use-update-report-1214-profile.js';
import { Form } from '../../../ui/form.js';
import { Separator } from '../../../ui/separator.js';
import {
  EditorActions,
  PhoneFields,
  TextField,
  useReportDirtyState,
  useResetAfterSave,
} from './profile-editor-parts.js';
import {
  companyFormSchema,
  companyFormToInput,
  companyToForm,
  preparerFormSchema,
  preparerFormToInput,
  preparerToForm,
  type CompanyFormState,
  type CompanyOverridesValue,
  type PreparerFormState,
  type PreparerValue,
} from './profile-forms.js';
import { useForm1214Report } from './report-context.js';

const FROM_BOOKS = 'From the books';

/**
 * The company identity overrides of the year's 1214 profile. An empty field leaves the value the
 * books supply (the business's details); a filled one replaces it in the report. Saves the whole
 * `company` block.
 */
export function Form1214CompanyEditor({
  company,
}: {
  company: CompanyOverridesValue | null | undefined;
}): ReactElement {
  const { year, refresh } = useForm1214Report();
  const defaults = useMemo(() => companyToForm(company), [company]);
  const form = useForm<CompanyFormState>({
    // Field errors show once a field is left (or on Save); Cancel and Save clear them
    mode: 'onTouched',
    resolver: zodResolver(companyFormSchema),
    defaultValues: defaults,
  });
  const { markSaved, cancel } = useResetAfterSave(form, defaults);
  const { updateReport1214Profile, fetching } = useUpdateReport1214Profile();
  useReportDirtyState('company', form.formState.isDirty);

  const onSubmit = async (values: CompanyFormState): Promise<void> => {
    const saved = await updateReport1214Profile(
      {
        year,
        input: { company: companyFormToInput(values) },
      },
      'company details',
    );
    if (saved) {
      markSaved(values);
      refresh();
    }
  };

  const { control } = form;
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* No edits while a save is in flight: they would be lost when the saved block lands */}
        <fieldset disabled={fetching} className="min-w-0 space-y-4">
          <div>
            <h3 className="font-semibold">Company details</h3>
            <p className="text-sm text-muted-foreground">
              Leave a field empty to use the value from the books.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              control={control}
              name="registeredName"
              label="Registered name"
              placeholder={`${FROM_BOOKS} (business name)`}
            />
            <TextField
              control={control}
              name="withholdingFileNumber"
              label="Withholding file number"
              placeholder={FROM_BOOKS}
              inputMode="numeric"
            />
            <PhoneFields control={control} name="phone" label="Phone" placeholder={FROM_BOOKS} />
            <PhoneFields control={control} name="fax" label="Fax" placeholder="Not reported" />
            <TextField
              control={control}
              name="email"
              label="Email"
              placeholder={FROM_BOOKS}
              inputMode="email"
            />
            <TextField
              control={control}
              name="occupationDescription"
              label="Occupation description"
              placeholder="Not reported"
            />
            <TextField
              control={control}
              name="mailingAddress"
              label="Mailing address"
              placeholder={`${FROM_BOOKS} (business address)`}
            />
            <TextField
              control={control}
              name="businessAddress"
              label="Business address"
              placeholder={`${FROM_BOOKS} (business address)`}
            />
            <TextField
              control={control}
              name="booksAddress"
              label="Where the books are kept"
              placeholder="Not reported"
            />
          </div>
        </fieldset>
        <EditorActions isDirty={form.formState.isDirty} saving={fetching} onCancel={cancel} />
      </form>
    </Form>
  );
}

/**
 * The person or office that helped fill in the report. Saves the whole `preparer` block; with
 * every field empty the block is cleared.
 */
export function Form1214PreparerEditor({
  preparer,
}: {
  preparer: PreparerValue | null | undefined;
}): ReactElement {
  const { year, refresh } = useForm1214Report();
  const defaults = useMemo(() => preparerToForm(preparer), [preparer]);
  const form = useForm<PreparerFormState>({
    // Field errors show once a field is left (or on Save); Cancel and Save clear them
    mode: 'onTouched',
    resolver: zodResolver(preparerFormSchema),
    defaultValues: defaults,
  });
  const { markSaved, cancel } = useResetAfterSave(form, defaults);
  const { updateReport1214Profile, fetching } = useUpdateReport1214Profile();
  useReportDirtyState('preparer', form.formState.isDirty);

  const onSubmit = async (values: PreparerFormState): Promise<void> => {
    const saved = await updateReport1214Profile(
      {
        year,
        input: { preparer: preparerFormToInput(values) },
      },
      'preparer details',
    );
    if (saved) {
      markSaved(values);
      refresh();
    }
  };

  const { control } = form;
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* No edits while a save is in flight: they would be lost when the saved block lands */}
        <fieldset disabled={fetching} className="min-w-0 space-y-4">
          <Separator />
          <div>
            <h3 className="font-semibold">Report preparer</h3>
            <p className="text-sm text-muted-foreground">
              The person or office that helped fill in the report. Leave every field empty when
              there is none.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField control={control} name="officeName" label="Office name" />
            <TextField control={control} name="contactName" label="Contact person" />
            <TextField control={control} name="name" label="Preparer name" />
            <TextField control={control} name="profession" label="Profession" />
            <TextField
              control={control}
              name="licensedDealerNumber"
              label="Licensed dealer number"
              placeholder="Up to 9 digits"
              inputMode="numeric"
            />
            <TextField control={control} name="address" label="Address" />
            <PhoneFields control={control} name="phone" label="Phone" />
          </div>
        </fieldset>
        <EditorActions isDirty={form.formState.isDirty} saving={fetching} onCancel={cancel} />
      </form>
    </Form>
  );
}
