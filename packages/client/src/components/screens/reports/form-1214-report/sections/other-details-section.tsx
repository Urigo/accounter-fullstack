import { useMemo, type ReactElement } from 'react';
import type { Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form1214OtherDetailsSectionFragmentDoc,
  type Report1214ProfileInput,
} from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
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
import { useProfileBlockForm } from '../editors/use-profile-block-form.js';
import { EditorActions, TriStateControl } from '../profile-editor-parts.js';
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
  const defaults = useMemo(() => otherDetailsFormFromBlock(block, stored), [block, stored]);
  const resolver = useMemo(() => zodResolver(otherDetailsFormSchema(block)), [block]);
  const { form, saving, onSubmit, cancel } = useProfileBlockForm<OtherDetailsFormState>({
    section: `other-details:${block.key}`,
    blockName: block.title.toLowerCase(),
    defaults,
    resolver,
    toInput: values => {
      const input = otherDetailsBlockToInput(block, otherDetailsValuesFromForm(block, values));
      // The schema ran the same checks, so the values are valid here
      return { [block.key]: input.ok ? input.value : null } as Report1214ProfileInput;
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0"
        aria-label={block.title}
      >
        <div>
          <h3 className="font-semibold">{block.title}</h3>
          <p className="text-sm text-muted-foreground">{block.description}</p>
        </div>
        <fieldset
          disabled={saving}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {block.fields.map((field, index) => (
            <FieldControl key={field.path} control={form.control} index={index} field={field} />
          ))}
        </fieldset>
        <EditorActions isDirty={form.formState.isDirty} saving={saving} onCancel={cancel} />
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
