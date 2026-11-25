import { useMemo, type ReactElement } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Form1214RdInvestmentsSectionFragmentDoc } from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
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
import { RD_TOTAL_CODE } from '../editors/amount-overrides.js';
import { describeField, EditorFooter } from '../editors/editor-footer.js';
import {
  emptyRdInvestmentRow,
  RD_INVESTMENTS_FORM_LIMIT,
  rdInvestmentRowsFromProfile,
  rdInvestmentRowsToInput,
  rdInvestmentsTotal,
  validateRdInvestmentRow,
  type RdInvestmentField,
  type RdInvestmentRow,
} from '../editors/rd-investments.js';
import { useBlockDraft } from '../editors/use-block-draft.js';
import { useSaveProfileBlock } from '../editors/use-save-profile-block.js';
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

const totalFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Investments in R&D companies (records 1030): edited as a list and saved whole. */
export function Form1214RdInvestmentsSection({ data }: Props): ReactElement {
  const { profile } = getFragmentData(Form1214RdInvestmentsSectionFragmentDoc, data);
  const draft = useBlockDraft('rd-investments', profile.rdInvestments, rdInvestmentRowsFromProfile);
  const { saving, errorMessage, save } = useSaveProfileBlock();
  const rows = draft.value;
  const rowErrors = useMemo(() => rows.map(validateRdInvestmentRow), [rows]);
  const hasErrors = rowErrors.some(errors => Object.keys(errors).length > 0);

  const updateRow = (rowId: string, patch: Partial<RdInvestmentRow>): void =>
    draft.update(current => current.map(row => (row.rowId === rowId ? { ...row, ...patch } : row)));

  const onSave = async (): Promise<void> => {
    const input = rdInvestmentRowsToInput(rows);
    if (!input.ok) {
      return;
    }
    if (await save({ rdInvestments: input.value }, 'R&D investments')) {
      draft.markSaved();
    }
  };

  return (
    <Section id="rd-investments" title="R&D investments">
      {rows.length === 0 ? (
        <Empty>
          {draft.dirty
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
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const field = (name: RdInvestmentField) =>
                describeField(draft, `${row.rowId}.${name}`, rowErrors[index]?.[name]);
              const name = field('companyName');
              const fileNumber = field('companyFileNumber');
              const amount = field('investmentAmount');
              return (
                <TableRow key={row.rowId} className="align-top">
                  <TableCell>
                    <Input
                      dir="auto"
                      aria-label={`R&D investment ${index + 1} company name`}
                      value={row.companyName}
                      onChange={event => updateRow(row.rowId, { companyName: event.target.value })}
                      {...name.inputProps}
                    />
                    {name.errorNode}
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="numeric"
                      className="w-32 font-mono"
                      aria-label={`R&D investment ${index + 1} file number`}
                      value={row.companyFileNumber}
                      onChange={event =>
                        updateRow(row.rowId, { companyFileNumber: event.target.value })
                      }
                      {...fileNumber.inputProps}
                    />
                    {fileNumber.errorNode}
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="decimal"
                      className="ml-auto w-36 text-right"
                      aria-label={`R&D investment ${index + 1} amount`}
                      value={row.investmentAmount}
                      onChange={event =>
                        updateRow(row.rowId, { investmentAmount: event.target.value })
                      }
                      {...amount.inputProps}
                    />
                    {amount.errorNode}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove R&D investment ${index + 1}`}
                      onClick={() =>
                        draft.update(current => current.filter(other => other.rowId !== row.rowId))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">
                Total (code {RD_TOTAL_CODE})
              </TableCell>
              <TableCell className="text-right font-semibold">
                {totalFormat.format(rdInvestmentsTotal(rows))}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        The total is reported as code {RD_TOTAL_CODE} automatically, each amount rounded to whole
        shekels.
      </p>
      {rows.length > RD_INVESTMENTS_FORM_LIMIT && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          The form has room for {RD_INVESTMENTS_FORM_LIMIT} R&D investments. You can save more, but
          the report validation lists the extra ones as an issue.
        </p>
      )}
      <EditorFooter
        dirty={draft.dirty}
        saving={saving}
        errorMessage={errorMessage}
        hasErrors={hasErrors}
        hasVisibleErrors={rows.some((row, index) =>
          Object.keys(rowErrors[index] ?? {}).some(name => draft.showError(`${row.rowId}.${name}`)),
        )}
        errorHint="Fill in a company name and an amount for every investment to save."
        onSave={() => void onSave()}
        onCancel={draft.cancel}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => draft.update(current => [...current, emptyRdInvestmentRow()])}
        >
          <Plus /> Add investment
        </Button>
      </EditorFooter>
    </Section>
  );
}
