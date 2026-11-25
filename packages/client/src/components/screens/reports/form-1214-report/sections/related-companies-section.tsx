import { useMemo, type ReactElement } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form1214RelatedCompaniesSectionFragmentDoc,
  type Report1214RelatedCompanyRelationType,
} from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { Button } from '../../../../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../../../ui/form.js';
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
import {
  emptyRelatedCompanyRow,
  RELATED_COMPANIES_FORM_LIMIT,
  relatedCompaniesFormSchema,
  relatedCompanyRowsFromProfile,
  relatedCompanyRowsToInput,
  RELATION_TYPE_LABELS,
  RELATION_TYPES,
  type RelatedCompaniesFormState,
} from '../editors/related-companies.js';
import { TableTextField } from '../editors/table-fields.js';
import { useProfileBlockForm } from '../editors/use-profile-block-form.js';
import { EditorActions } from '../profile-editor-parts.js';
import { useForm1214Report } from '../report-context.js';
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

type StoredRelatedCompanies = Parameters<typeof relatedCompanyRowsFromProfile>[0];

/** Related companies (records 1010): edited as a list and saved whole. */
export function Form1214RelatedCompaniesSection({ data }: Props): ReactElement {
  const { profile } = getFragmentData(Form1214RelatedCompaniesSectionFragmentDoc, data);
  // A draft belongs to its year: another year starts a fresh one
  const { year } = useForm1214Report();
  return (
    <Section id="related-companies" title="Related companies">
      <RelatedCompaniesEditor key={year} relatedCompanies={profile.relatedCompanies} />
    </Section>
  );
}

function RelatedCompaniesEditor({
  relatedCompanies,
}: {
  relatedCompanies: StoredRelatedCompanies;
}): ReactElement {
  const defaults = useMemo<RelatedCompaniesFormState>(
    () => ({ rows: relatedCompanyRowsFromProfile(relatedCompanies) }),
    [relatedCompanies],
  );
  const { form, saving, onSubmit, cancel } = useProfileBlockForm<RelatedCompaniesFormState>({
    section: 'related-companies',
    blockName: 'related companies',
    defaults,
    resolver: zodResolver(relatedCompaniesFormSchema),
    toInput: values => {
      const input = relatedCompanyRowsToInput(values.rows);
      // The schema ran the same checks, so the rows are valid here
      return { relatedCompanies: input.ok ? input.value : [] };
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rows' });
  const { isDirty } = form.formState;

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-3" aria-label="Related companies">
        <fieldset disabled={saving} className="space-y-3">
          {fields.length === 0 ? (
            <Empty>
              {isDirty
                ? 'Every related company is removed: save to clear the year.'
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
                {fields.map((row, index) => (
                  <TableRow key={row.id} className="align-top">
                    <TableCell>
                      <TableTextField
                        control={form.control}
                        name={`rows.${index}.companyName`}
                        label={`Related company ${index + 1} name`}
                        dir="auto"
                      />
                    </TableCell>
                    <TableCell>
                      <TableTextField
                        control={form.control}
                        name={`rows.${index}.companyFileNumber`}
                        label={`Related company ${index + 1} file number`}
                        inputMode="numeric"
                        className="w-32 font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`rows.${index}.relationType`}
                        render={({ field }): ReactElement => (
                          <FormItem className="gap-1">
                            <Select
                              value={field.value || undefined}
                              onValueChange={value =>
                                field.onChange(value as Report1214RelatedCompanyRelationType)
                              }
                              disabled={saving}
                            >
                              <FormControl>
                                <SelectTrigger
                                  ref={field.ref}
                                  className="w-56"
                                  aria-label={`Related company ${index + 1} relation`}
                                >
                                  <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {RELATION_TYPES.map(type => (
                                  <SelectItem key={type} value={type}>
                                    {RELATION_TYPE_LABELS[type]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <TableTextField
                        control={form.control}
                        name={`rows.${index}.assessingOfficeCode`}
                        label={`Related company ${index + 1} assessing office code`}
                        inputMode="numeric"
                        className="w-24 font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove related company ${index + 1}`}
                        onClick={() => remove(index)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {fields.length > RELATED_COMPANIES_FORM_LIMIT && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              The form has room for {RELATED_COMPANIES_FORM_LIMIT} related companies. You can save
              more, but the report validation lists the extra ones as an issue.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(emptyRelatedCompanyRow())}
          >
            <Plus /> Add company
          </Button>
        </fieldset>
        <EditorActions isDirty={isDirty} saving={saving} onCancel={cancel} />
      </form>
    </Form>
  );
}
