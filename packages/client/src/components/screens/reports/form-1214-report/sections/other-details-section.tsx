import { useMemo, type ReactElement } from 'react';
import { useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form1214OtherDetailsSectionFragmentDoc,
  type Report1214ProfileInput,
} from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { useUpdateReport1214Profile } from '../../../../../hooks/use-update-report-1214-profile.js';
import { Checkbox } from '../../../../ui/checkbox.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../../ui/form.js';
import { Input } from '../../../../ui/input.js';
import {
  OTHER_DETAILS_BLOCKS,
  otherDetailsBlockToInput,
  otherDetailsFormFromBlock,
  otherDetailsFormSchema,
  otherDetailsValuesFromForm,
  type OtherDetailsBlock,
  type OtherDetailsField,
  type OtherDetailsFormState,
} from '../editors/other-details.js';
import {
  EditorActions,
  TriStateControl,
  useReportDirtyState,
  useResetAfterSave,
} from '../profile-editor-parts.js';
import type { TriState } from '../profile-forms.js';
import { useForm1214Report } from '../report-context.js';
import { Section } from './section-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214OtherDetailsSection on Report1214 {
    id
    profile {
      id
      attachments {
        donationReceiptsCount
        withholdingCertificatesCount
      }
      bankAccount {
        bank
        branch
        account
      }
      otherTaxableIncome {
        source
        amount
        ratePercent
      }
      capitalGainsSummary {
        totalAppendicesCount
        untransmittedCount
        reasons {
          lossOrNoGain
          overFiveImprovementBalances
          over14Appendices
          other
          otherText
        }
      }
      qualifyingCompany {
        purchased
        israeliPurchaseAmount
        foreignPurchaseAmount
        amortizationClaimed
        amortizationAmount
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214OtherDetailsSectionFragmentDoc>;
};

/** The smaller profile blocks, each a form with its own Save. */
export function Form1214OtherDetailsSection({ data }: Props): ReactElement {
  const { profile } = getFragmentData(Form1214OtherDetailsSectionFragmentDoc, data);
  // A draft belongs to its year: another year starts a fresh one
  const { year } = useForm1214Report();
  return (
    <Section id="other-details" title="Other details">
      <div className="space-y-6">
        {OTHER_DETAILS_BLOCKS.map(block => (
          <OtherDetailsBlockEditor
            key={`${year}-${block.key}`}
            block={block}
            stored={profile[block.key]}
          />
        ))}
      </div>
    </Section>
  );
}

/** One block: an empty block is not stored, and saving one with every field empty clears it. */
function OtherDetailsBlockEditor({
  block,
  stored,
}: {
  block: OtherDetailsBlock;
  stored: object | null | undefined;
}): ReactElement {
  const { year, refresh } = useForm1214Report();
  const defaults = useMemo(() => otherDetailsFormFromBlock(block, stored), [block, stored]);
  const schema = useMemo(() => otherDetailsFormSchema(block), [block]);
  const form = useForm<OtherDetailsFormState>({
    // Field errors show once a field is left (or on Save); Cancel and Save clear them
    mode: 'onTouched',
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const { markSaved, cancel } = useResetAfterSave(form, defaults);
  const { updateReport1214Profile, fetching, errorMessage } = useUpdateReport1214Profile();
  useReportDirtyState(`other-details:${block.key}`, form.formState.isDirty);

  const onSubmit = async (values: OtherDetailsFormState): Promise<void> => {
    const input = otherDetailsBlockToInput(block, otherDetailsValuesFromForm(block, values));
    if (!input.ok) {
      return;
    }
    const saved = await updateReport1214Profile({
      year,
      input: { [block.key]: input.value } as Report1214ProfileInput,
      blockName: block.title.toLowerCase(),
    });
    if (saved) {
      markSaved(values);
      refresh();
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0"
        aria-label={block.title}
      >
        <div>
          <h3 className="font-semibold">{block.title}</h3>
          <p className="text-sm text-muted-foreground">{block.description}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {block.fields.map((field, index) => (
            <FieldControl key={field.path} control={form.control} index={index} field={field} />
          ))}
        </div>
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

function FieldControl({
  control,
  index,
  field: definition,
}: {
  control: Control<OtherDetailsFormState>;
  index: number;
  field: OtherDetailsField;
}): ReactElement {
  return (
    <FormField
      control={control}
      name={`values.${index}`}
      render={({ field }): ReactElement => {
        if (definition.kind === 'flag') {
          return (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <Checkbox
                  checked={field.value === 'true'}
                  onCheckedChange={checked => field.onChange(checked === true ? 'true' : '')}
                />
              </FormControl>
              <FormLabel className="font-normal">{definition.label}</FormLabel>
            </FormItem>
          );
        }
        if (definition.kind === 'yesNo') {
          return (
            <FormItem className="space-y-1">
              <FormLabel>{definition.label}</FormLabel>
              <FormControl>
                <TriStateControl
                  label={definition.label}
                  value={(field.value ?? '') as TriState}
                  onChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          );
        }
        const numeric = definition.kind !== 'text';
        return (
          <FormItem className="space-y-1">
            <FormLabel>{definition.label}</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                dir={numeric ? undefined : 'auto'}
                inputMode={
                  definition.kind === 'number' ? 'decimal' : numeric ? 'numeric' : undefined
                }
                className={definition.kind === 'digits' ? 'font-mono' : undefined}
                maxLength={definition.kind === 'digits' ? definition.digits?.[1] : undefined}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
