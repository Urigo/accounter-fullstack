import { useState, type ReactElement } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Form1214AmountsSectionFragmentDoc } from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { Badge } from '../../../../ui/badge.js';
import { Button } from '../../../../ui/button.js';
import { Input } from '../../../../ui/input.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table.js';
import {
  addAmountOverrideDraft,
  amountEditorRows,
  amountOverrideDraftsFromProfile,
  buildAmountOverridesInput,
  newOverrideCodeError,
  overrideAmountError,
  RD_TOTAL_CODE,
  type AmountOverrideDraft,
} from '../editors/amount-overrides.js';
import { describeField, EditorFooter, FieldError } from '../editors/editor-footer.js';
import { numberToText } from '../editors/form-values.js';
import { useBlockDraft } from '../editors/use-block-draft.js';
import { useSaveProfileBlock } from '../editors/use-save-profile-block.js';
import { Empty, formatNumber, Section } from './section-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214AmountsSection on Report1214 {
    id
    profile {
      id
      amountOverrides {
        code
        amount
      }
    }
    amounts {
      code
      amount
      source
      computedAmount
      label
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214AmountsSectionFragmentDoc>;
};

/**
 * The record 1000 amounts: what Accounter computes, and the overrides entered by hand. The
 * overrides are edited here and saved as one list; code 165 always follows the R&D investments.
 */
export function Form1214AmountsSection({ data }: Props): ReactElement {
  const { profile, amounts } = getFragmentData(Form1214AmountsSectionFragmentDoc, data);
  const draft = useBlockDraft(profile.amountOverrides, amountOverrideDraftsFromProfile);
  const { saving, save } = useSaveProfileBlock();
  const [newCode, setNewCode] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [addErrors, setAddErrors] = useState<{ code?: string; amount?: string }>({});
  const drafts = draft.value;
  const rows = amountEditorRows(amounts, drafts);
  const hasErrors = drafts.some(override => overrideAmountError(override.amount) !== null);

  const setOverride = (code: string, amount: string): void =>
    draft.update(current =>
      current.map(override => (override.code === code ? { ...override, amount } : override)),
    );
  const removeOverride = (code: string): void =>
    draft.update(current => current.filter(override => override.code !== code));
  const addOverride = (code: string, amount: string, current: AmountOverrideDraft[]): void =>
    draft.update(() => addAmountOverrideDraft(current, code, amount));

  // The new-override inputs are checked when "Add" is pressed, not while typing
  const onAdd = (): void => {
    const errors = {
      code: newOverrideCodeError(newCode, drafts) ?? undefined,
      amount: overrideAmountError(newAmount) ?? undefined,
    };
    setAddErrors(errors);
    if (errors.code || errors.amount) {
      return;
    }
    addOverride(newCode, newAmount, drafts);
    setNewCode('');
    setNewAmount('');
  };

  const onSave = async (): Promise<void> => {
    const input = buildAmountOverridesInput(drafts);
    if (!input.ok) {
      draft.attemptSave();
      return;
    }
    if (await save({ amountOverrides: input.value }, 'amount overrides')) {
      draft.markSaved();
    }
  };

  return (
    <Section id="amounts" title="Amounts (record 1000)">
      <p className="mb-3 text-sm text-muted-foreground">
        An override replaces the computed amount of its code. An override of 0 is kept, not removed:
        for a code that does not allow zero, it leaves the code out of the report. Remove an
        override to go back to the computed amount. Code {RD_TOTAL_CODE} is the total of the R&D
        investments and always follows them.
      </p>
      {rows.length === 0 ? (
        <Empty>No amounts are computed or entered for this year.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Computed</TableHead>
              <TableHead className="text-right">Override</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.code} className="align-top">
                <TableCell className="font-mono">{row.code}</TableCell>
                <TableCell dir="auto">{row.label ?? ''}</TableCell>
                <TableCell className="text-right">{formatNumber(row.computedAmount)}</TableCell>
                <TableCell className="text-right">
                  {row.override === undefined ? (
                    row.readOnly ? (
                      <span className="text-sm text-muted-foreground">From R&D investments</span>
                    ) : (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() =>
                          addOverride(row.code, numberToText(row.computedAmount), drafts)
                        }
                        aria-label={`Override code ${row.code}`}
                      >
                        Override
                      </Button>
                    )
                  ) : row.readOnly ? (
                    // An override of 165 can only come from the API; it can be removed, not edited
                    <span
                      title={`Remove it to let code ${RD_TOTAL_CODE} follow the R&D investments`}
                    >
                      {row.override}
                    </span>
                  ) : (
                    <OverrideInput
                      code={row.code}
                      value={row.override}
                      onChange={amount => setOverride(row.code, amount)}
                      field={describeField(
                        draft,
                        `override.${row.code}`,
                        overrideAmountError(row.override) ?? undefined,
                      )}
                    />
                  )}
                </TableCell>
                <TableCell>
                  {row.override === undefined ? (
                    <Badge variant="secondary">Computed</Badge>
                  ) : (
                    <Badge variant="outline">Override</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {row.override !== undefined && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove the override of code ${row.code}`}
                      onClick={() => removeOverride(row.code)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <EditorFooter
        dirty={draft.dirty}
        saving={saving}
        blocked={draft.saveAttempted && hasErrors}
        onSave={() => void onSave()}
        onCancel={draft.cancel}
      >
        <div className="flex flex-wrap items-start gap-2">
          <div>
            <Input
              inputMode="numeric"
              maxLength={3}
              className="w-24 font-mono"
              placeholder="Code"
              aria-label="Code of the new override"
              aria-invalid={addErrors.code ? true : undefined}
              aria-describedby={addErrors.code ? 'form-1214-new-override-code-error' : undefined}
              value={newCode}
              onChange={event => {
                setNewCode(event.target.value);
                setAddErrors(errors => ({ ...errors, code: undefined }));
              }}
            />
            {addErrors.code && (
              <FieldError id="form-1214-new-override-code-error" message={addErrors.code} />
            )}
          </div>
          <div>
            <Input
              inputMode="decimal"
              className="w-36 text-right"
              placeholder="Amount"
              aria-label="Amount of the new override"
              aria-invalid={addErrors.amount ? true : undefined}
              aria-describedby={
                addErrors.amount ? 'form-1214-new-override-amount-error' : undefined
              }
              value={newAmount}
              onChange={event => {
                setNewAmount(event.target.value);
                setAddErrors(errors => ({ ...errors, amount: undefined }));
              }}
            />
            {addErrors.amount && (
              <FieldError id="form-1214-new-override-amount-error" message={addErrors.amount} />
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus /> Add override
          </Button>
        </div>
      </EditorFooter>
    </Section>
  );
}

function OverrideInput({
  code,
  value,
  onChange,
  field,
}: {
  code: string;
  value: string;
  onChange: (amount: string) => void;
  field: ReturnType<typeof describeField>;
}): ReactElement {
  return (
    <div className="ml-auto w-36">
      <Input
        inputMode="decimal"
        className="text-right"
        aria-label={`Override of code ${code}`}
        value={value}
        onChange={event => onChange(event.target.value)}
        {...field.inputProps}
      />
      {field.errorNode}
    </div>
  );
}
