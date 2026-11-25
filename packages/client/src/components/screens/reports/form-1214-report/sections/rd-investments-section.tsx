import { useMemo, useRef, type ReactElement } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form1214RdInvestmentsSectionFragmentDoc } from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { Button } from '../../../../ui/button.js';
import { Form } from '../../../../ui/form.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table.js';
import { RD_TOTAL_CODE } from '../editors/amount-overrides.js';
import {
  emptyRdInvestmentRow,
  RD_INVESTMENTS_FORM_LIMIT,
  rdInvestmentRowsFromProfile,
  rdInvestmentRowsToInput,
  rdInvestmentsFormSchema,
  rdInvestmentsTotal,
  type RdInvestmentsFormState,
} from '../editors/rd-investments.js';
import { TableTextField } from '../editors/table-fields.js';
import { useProfileBlockForm } from '../editors/use-profile-block-form.js';
import { EditorActions } from '../profile-editor-parts.js';
import { useForm1214Report } from '../report-context.js';
import { Empty, Section } from './section-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214RdInvestmentsSection on Report1214 {
    id
    profile {
      id
      rdInvestments {
        companyName
        companyFileNumber
        investmentAmount
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214RdInvestmentsSectionFragmentDoc>;
};

type StoredRdInvestments = Parameters<typeof rdInvestmentRowsFromProfile>[0];

const totalFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Investments in R&D companies (records 1030): edited as a list and saved whole. */
export function Form1214RdInvestmentsSection({ data }: Props): ReactElement {
  const { profile } = getFragmentData(Form1214RdInvestmentsSectionFragmentDoc, data);
  // A draft belongs to its year: another year starts a fresh one
  const { year } = useForm1214Report();
  return (
    <Section id="rd-investments" title="R&D investments">
      <RdInvestmentsEditor key={year} rdInvestments={profile.rdInvestments} />
    </Section>
  );
}

function RdInvestmentsEditor({
  rdInvestments,
}: {
  rdInvestments: StoredRdInvestments;
}): ReactElement {
  const defaults = useMemo<RdInvestmentsFormState>(
    () => ({ rows: rdInvestmentRowsFromProfile(rdInvestments) }),
    [rdInvestments],
  );
  const { form, saving, onSubmit, cancel } = useProfileBlockForm<RdInvestmentsFormState>({
    section: 'rd-investments',
    blockName: 'R&D investments',
    defaults,
    resolver: zodResolver(rdInvestmentsFormSchema),
    toInput: values => {
      const input = rdInvestmentRowsToInput(values.rows);
      // The schema ran the same checks; `null` (never expected) sends nothing
      return input.ok ? { rdInvestments: input.value } : null;
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rows' });
  const rows = useWatch({ control: form.control, name: 'rows' });
  const { isDirty } = form.formState;
  const addButton = useRef<HTMLButtonElement>(null);
  // The removed row's button disappears: move the focus to the add button
  const removeRow = (index: number): void => {
    remove(index);
    addButton.current?.focus();
  };

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-3" aria-label="R&D investments">
        <fieldset disabled={saving} className="min-w-0 space-y-3">
          {fields.length === 0 ? (
            <Empty>
              {isDirty
                ? 'Every R&D investment is removed: save to clear the year.'
                : 'No R&D investments are saved for this year.'}
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>File number</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((row, index) => (
                  <TableRow key={row.id} className="align-top">
                    <TableCell>
                      <TableTextField
                        control={form.control}
                        name={`rows.${index}.companyName`}
                        label={`R&D investment ${index + 1} company name`}
                        dir="auto"
                      />
                    </TableCell>
                    <TableCell>
                      <TableTextField
                        control={form.control}
                        name={`rows.${index}.companyFileNumber`}
                        label={`R&D investment ${index + 1} file number`}
                        inputMode="numeric"
                        className="w-32 font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <TableTextField
                        control={form.control}
                        name={`rows.${index}.investmentAmount`}
                        label={`R&D investment ${index + 1} amount`}
                        inputMode="decimal"
                        className="ml-auto w-36 text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove R&D investment ${index + 1}`}
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">
                    Total (code {RD_TOTAL_CODE})
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {totalFormat.format(rdInvestmentsTotal(rows ?? []))}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
          <p className="text-sm text-muted-foreground">
            The total is reported as code {RD_TOTAL_CODE} automatically, each amount rounded to
            whole shekels.
          </p>
          {fields.length > RD_INVESTMENTS_FORM_LIMIT && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              The form has room for {RD_INVESTMENTS_FORM_LIMIT} R&D investments. You can save more,
              but the report validation lists the extra ones as an issue.
            </p>
          )}
          <Button
            ref={addButton}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(emptyRdInvestmentRow())}
          >
            <Plus /> Add investment
          </Button>
        </fieldset>
        <EditorActions isDirty={isDirty} saving={saving} onCancel={cancel} />
      </form>
    </Form>
  );
}
