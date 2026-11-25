import { useMemo, type ReactElement, type ReactNode } from 'react';
import {
  Form1214OtherDetailsSectionFragmentDoc,
  type Report1214ProfileInput,
} from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { Checkbox } from '../../../../ui/checkbox.js';
import { Input } from '../../../../ui/input.js';
import { Label } from '../../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select.js';
import { describeField, EditorFooter } from '../editors/editor-footer.js';
import {
  OTHER_DETAILS_BLOCKS,
  otherDetailsBlockToInput,
  otherDetailsFieldErrors,
  otherDetailsValuesFromBlock,
  type OtherDetailsBlock,
  type OtherDetailsField,
} from '../editors/other-details.js';
import { useBlockDraft } from '../editors/use-block-draft.js';
import { useSaveProfileBlock } from '../editors/use-save-profile-block.js';
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

/** The smaller profile blocks, each with its own Save. */
export function Form1214OtherDetailsSection({ data }: Props): ReactElement {
  const { profile } = getFragmentData(Form1214OtherDetailsSectionFragmentDoc, data);
  return (
    <Section id="other-details" title="Other details">
      <div className="space-y-6">
        {OTHER_DETAILS_BLOCKS.map(block => (
          <OtherDetailsBlockEditor key={block.key} block={block} stored={profile[block.key]} />
        ))}
      </div>
    </Section>
  );
}

const UNSET = 'unset';

function OtherDetailsBlockEditor({
  block,
  stored,
}: {
  block: OtherDetailsBlock;
  stored: object | null | undefined;
}): ReactElement {
  const draft = useBlockDraft(`other-details:${block.key}`, stored, value =>
    otherDetailsValuesFromBlock(block, value),
  );
  const { saving, save } = useSaveProfileBlock();
  const values = draft.value;
  const errors = useMemo(() => otherDetailsFieldErrors(block, values), [block, values]);
  const hasErrors = Object.keys(errors).length > 0;

  const setValue = (path: string, text: string): void =>
    draft.update(current => ({ ...current, [path]: text }));

  const onSave = async (): Promise<void> => {
    const input = otherDetailsBlockToInput(block, values);
    if (!input.ok) {
      return;
    }
    const blockInput = { [block.key]: input.value } as Report1214ProfileInput;
    if (await save(blockInput, block.title.toLowerCase())) {
      draft.markSaved();
    }
  };

  return (
    <fieldset className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <legend className="font-semibold">{block.title}</legend>
      <p className="text-sm text-muted-foreground">{block.description}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {block.fields.map(field => (
          <FieldControl
            key={field.path}
            id={`form-1214-${block.key}-${field.path}`}
            field={field}
            value={values[field.path] ?? ''}
            onChange={text => setValue(field.path, text)}
            described={describeField(draft, `${block.key}.${field.path}`, errors[field.path])}
          />
        ))}
      </div>
      <EditorFooter
        dirty={draft.dirty}
        saving={saving}
        hasErrors={hasErrors}
        hasVisibleErrors={Object.keys(errors).some(path => draft.showError(`${block.key}.${path}`))}
        errorHint="Fix the fields of this block to save."
        onSave={() => void onSave()}
        onCancel={draft.cancel}
      />
    </fieldset>
  );
}

function FieldControl({
  id,
  field,
  value,
  onChange,
  described,
}: {
  id: string;
  field: OtherDetailsField;
  value: string;
  onChange: (text: string) => void;
  described: { inputProps: object; errorNode: ReactNode };
}): ReactElement {
  if (field.kind === 'flag') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={value === 'true'}
          onCheckedChange={checked => onChange(checked === true ? 'true' : '')}
        />
        <Label htmlFor={id}>{field.label}</Label>
      </div>
    );
  }
  if (field.kind === 'yesNo') {
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{field.label}</Label>
        <Select value={value || UNSET} onValueChange={next => onChange(next === UNSET ? '' : next)}>
          <SelectTrigger id={id} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>Not set</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
  const numeric = field.kind !== 'text';
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        dir={numeric ? undefined : 'auto'}
        inputMode={field.kind === 'number' ? 'decimal' : numeric ? 'numeric' : undefined}
        className={field.kind === 'digits' ? 'font-mono' : undefined}
        maxLength={field.kind === 'digits' ? field.digits?.[1] : undefined}
        value={value}
        onChange={event => onChange(event.target.value)}
        {...described.inputProps}
      />
      {described.errorNode}
    </div>
  );
}
