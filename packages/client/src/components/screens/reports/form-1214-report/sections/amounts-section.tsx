import { useMemo, useState, type ReactElement } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form1214AmountsSectionFragmentDoc,
  type Form1214AmountsSectionFragment,
} from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { Badge } from '../../../../ui/badge.js';
import { Button } from '../../../../ui/button.js';
import { Form } from '../../../../ui/form.js';
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
  amountEditorRows,
  amountOverrideDraftsFromProfile,
  amountOverridesFormSchema,
  buildAmountOverridesInput,
  newOverrideCodeError,
  overrideAmountError,
  overrideInsertIndex,
  RD_TOTAL_CODE,
  type AmountOverridesFormState,
} from '../editors/amount-overrides.js';
import { numberToText } from '../editors/form-values.js';
import { TableTextField } from '../editors/table-fields.js';
import { useProfileBlockForm } from '../editors/use-profile-block-form.js';
import { EditorActions } from '../profile-editor-parts.js';
import { useForm1214Report } from '../report-context.js';
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

type Report = Form1214AmountsSectionFragment;

/**
 * The record 1000 amounts: what Accounter computes, and the overrides entered by hand. The
 * overrides are edited here and saved as one list; code 165 always follows the R&D investments.
 */
export function Form1214AmountsSection({ data }: Props): ReactElement {
  const { profile, amounts } = getFragmentData(Form1214AmountsSectionFragmentDoc, data);
  // A draft belongs to its year: another year starts a fresh one
  const { year } = useForm1214Report();
  return (
    <Section id="amounts" title="Amounts (record 1000)">
      <p className="mb-3 text-sm text-muted-foreground">
        An override replaces the computed amount of its code. An override of 0 is kept, not removed:
        for a code that does not allow zero, it leaves the code out of the report. Remove an
        override to go back to the computed amount. Code {RD_TOTAL_CODE} is the total of the R&D
        investments and always follows them.
      </p>
      <AmountsEditor key={year} overrides={profile.amountOverrides} amounts={amounts} />
    </Section>
  );
}

const NEW_CODE_ERROR_ID = 'form-1214-new-override-code-error';
const NEW_AMOUNT_ERROR_ID = 'form-1214-new-override-amount-error';

function AmountsEditor({
  overrides,
  amounts,
}: {
  overrides: Report['profile']['amountOverrides'];
  amounts: Report['amounts'];
}): ReactElement {
  const defaults = useMemo<AmountOverridesFormState>(
    () => ({ overrides: amountOverrideDraftsFromProfile(overrides) }),
    [overrides],
  );
  const { form, saving, onSubmit, cancel } = useProfileBlockForm<AmountOverridesFormState>({
    section: 'amounts',
    blockName: 'amount overrides',
    defaults,
    resolver: zodResolver(amountOverridesFormSchema),
    toInput: values => {
      const input = buildAmountOverridesInput(values.overrides);
      // The schema ran the same checks, so the overrides are valid here
      return { amountOverrides: input.ok ? input.value : [] };
    },
  });
  const { fields, insert, remove } = useFieldArray({ control: form.control, name: 'overrides' });
  const { isDirty } = form.formState;

  // The codes do not change once added, so the field array's snapshot is enough for them
  const rows = amountEditorRows(amounts, fields);
  const indexByCode = new Map(fields.map((field, index) => [field.code, index]));

  const [newCode, setNewCode] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [addErrors, setAddErrors] = useState<{ code?: string; amount?: string }>({});

  const addOverride = (code: string, amount: string): void => {
    const trimmed = code.trim();
    insert(overrideInsertIndex(fields, trimmed), { code: trimmed, amount });
  };

  // The new-override inputs are checked when "Add" is pressed, not while typing
  const onAdd = (): void => {
    const errors = {
      code: newOverrideCodeError(newCode, fields) ?? undefined,
      amount: overrideAmountError(newAmount) ?? undefined,
    };
    setAddErrors(errors);
    if (errors.code || errors.amount) {
      return;
    }
    addOverride(newCode, newAmount);
    setNewCode('');
    setNewAmount('');
  };

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-3" aria-label="Amount overrides">
        <fieldset disabled={saving} className="space-y-3">
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
                {rows.map(row => {
                  const index = indexByCode.get(row.code);
                  return (
                    <TableRow key={row.code} className="align-top">
                      <TableCell className="font-mono">{row.code}</TableCell>
                      <TableCell dir="auto">{row.label ?? ''}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.computedAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {index === undefined ? (
                          row.readOnly ? (
                            <span className="text-sm text-muted-foreground">
                              From R&D investments
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              aria-label={`Override code ${row.code}`}
                              onClick={() =>
                                addOverride(row.code, numberToText(row.computedAmount))
                              }
                            >
                              Override
                            </Button>
                          )
                        ) : row.readOnly ? (
                          // An override of 165 can only come from the API: it can be removed, not
                          // edited
                          <span
                            title={`Remove it to let code ${RD_TOTAL_CODE} follow the R&D investments`}
                          >
                            {row.override}
                          </span>
                        ) : (
                          <div className="ml-auto w-36">
                            <TableTextField
                              control={form.control}
                              name={`overrides.${index}.amount`}
                              label={`Override of code ${row.code}`}
                              inputMode="decimal"
                              className="text-right"
                            />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {index === undefined ? (
                          <Badge variant="secondary">Computed</Badge>
                        ) : (
                          <Badge variant="outline">Override</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {index !== undefined && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove the override of code ${row.code}`}
                            onClick={() => remove(index)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <div className="flex flex-wrap items-start gap-2">
            <div>
              <Input
                inputMode="numeric"
                maxLength={3}
                className="w-24 font-mono"
                placeholder="Code"
                aria-label="Code of the new override"
                aria-invalid={addErrors.code ? true : undefined}
                aria-describedby={addErrors.code ? NEW_CODE_ERROR_ID : undefined}
                value={newCode}
                onChange={event => {
                  setNewCode(event.target.value);
                  setAddErrors(errors => ({ ...errors, code: undefined }));
                }}
              />
              {addErrors.code && <AddError id={NEW_CODE_ERROR_ID} message={addErrors.code} />}
            </div>
            <div>
              <Input
                inputMode="decimal"
                className="w-36 text-right"
                placeholder="Amount"
                aria-label="Amount of the new override"
                aria-invalid={addErrors.amount ? true : undefined}
                aria-describedby={addErrors.amount ? NEW_AMOUNT_ERROR_ID : undefined}
                value={newAmount}
                onChange={event => {
                  setNewAmount(event.target.value);
                  setAddErrors(errors => ({ ...errors, amount: undefined }));
                }}
              />
              {addErrors.amount && <AddError id={NEW_AMOUNT_ERROR_ID} message={addErrors.amount} />}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onAdd}>
              <Plus /> Add override
            </Button>
          </div>
        </fieldset>
        <EditorActions isDirty={isDirty} saving={saving} onCancel={cancel} />
      </form>
    </Form>
  );
}

function AddError({ id, message }: { id: string; message: string }): ReactElement {
  return (
    <p id={id} className="mt-1 text-xs text-red-500 dark:text-red-900">
      {message}
    </p>
  );
}
