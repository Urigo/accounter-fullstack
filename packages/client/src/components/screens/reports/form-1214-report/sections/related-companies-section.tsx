import type { ReactElement } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Form1214RelatedCompaniesSectionFragmentDoc,
  type Report1214RelatedCompanyRelationType,
} from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { Button } from '../../../../ui/button.js';
import { Input } from '../../../../ui/input.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table.js';
import { EditorFooter } from '../editors/editor-footer.js';
import {
  emptyRelatedCompanyRow,
  RELATED_COMPANIES_FORM_LIMIT,
  relatedCompanyRowsFromProfile,
  relatedCompanyRowsToInput,
  RELATION_TYPE_LABELS,
  RELATION_TYPES,
  type RelatedCompanyRow,
} from '../editors/related-companies.js';
import { useBlockDraft } from '../editors/use-block-draft.js';
import { useSaveProfileBlock } from '../editors/use-save-profile-block.js';
import { Empty, Section } from './section-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214RelatedCompaniesSection on Report1214 {
    id
    profile {
      id
      relatedCompanies {
        companyName
        companyFileNumber
        relationType
        assessingOfficeCode
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214RelatedCompaniesSectionFragmentDoc>;
};

/** Related companies (records 1010): edited as a list and saved whole. */
export function Form1214RelatedCompaniesSection({ data }: Props): ReactElement {
  const { profile } = getFragmentData(Form1214RelatedCompaniesSectionFragmentDoc, data);
  const draft = useBlockDraft(profile.relatedCompanies, relatedCompanyRowsFromProfile);
  const { saving, save } = useSaveProfileBlock();
  const rows = draft.value;

  const updateRow = (rowId: string, patch: Partial<RelatedCompanyRow>): void =>
    draft.update(current => current.map(row => (row.rowId === rowId ? { ...row, ...patch } : row)));

  const onSave = async (): Promise<void> => {
    const input = relatedCompanyRowsToInput(rows);
    if (!input.ok) {
      draft.setError(input.error);
      return;
    }
    if (await save({ relatedCompanies: input.value }, 'related companies')) {
      draft.markSaved();
    }
  };

  return (
    <Section id="related-companies" title="Related companies">
      {rows.length === 0 ? (
        <Empty>
          {draft.dirty
            ? 'Save to clear the related companies of this year.'
            : 'No related companies are saved for this year.'}
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>File number</TableHead>
              <TableHead>Relation</TableHead>
              <TableHead>Assessing office</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.rowId}>
                <TableCell>
                  <Input
                    dir="auto"
                    aria-label={`Related company ${index + 1} name`}
                    value={row.companyName}
                    onChange={event => updateRow(row.rowId, { companyName: event.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    inputMode="numeric"
                    className="w-32 font-mono"
                    aria-label={`Related company ${index + 1} file number`}
                    value={row.companyFileNumber}
                    onChange={event =>
                      updateRow(row.rowId, { companyFileNumber: event.target.value })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={row.relationType || undefined}
                    onValueChange={value =>
                      updateRow(row.rowId, {
                        relationType: value as Report1214RelatedCompanyRelationType,
                      })
                    }
                  >
                    <SelectTrigger
                      className="w-56"
                      aria-label={`Related company ${index + 1} relation`}
                    >
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATION_TYPES.map(type => (
                        <SelectItem key={type} value={type}>
                          {RELATION_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    inputMode="numeric"
                    className="w-24 font-mono"
                    aria-label={`Related company ${index + 1} assessing office code`}
                    value={row.assessingOfficeCode}
                    onChange={event =>
                      updateRow(row.rowId, { assessingOfficeCode: event.target.value })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove related company ${index + 1}`}
                    onClick={() =>
                      draft.update(current => current.filter(other => other.rowId !== row.rowId))
                    }
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {rows.length > RELATED_COMPANIES_FORM_LIMIT && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          The form has room for {RELATED_COMPANIES_FORM_LIMIT} related companies. You can save more,
          but the report validation lists the extra ones as an issue.
        </p>
      )}
      <EditorFooter
        dirty={draft.dirty}
        saving={saving}
        error={draft.error}
        onSave={() => void onSave()}
        onCancel={draft.cancel}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => draft.update(current => [...current, emptyRelatedCompanyRow()])}
        >
          <Plus /> Add company
        </Button>
      </EditorFooter>
    </Section>
  );
}
