import { ReactElement, useCallback, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { MonthPickerInput } from '@mantine/dates';
import { FragmentType, getFragmentData } from '../../../../gql/fragment-masking.js';
import {
  BillingCycle,
  Currency,
  IssueDocumentClientFieldsFragmentDoc,
  IssueMonthlyDocumentsMutationVariables,
  NewDocumentInfoFragment,
  NewDocumentInfoFragmentDoc,
  NewDocumentInput,
} from '../../../../gql/graphql.js';
import { TimelessDateString } from '../../../../helpers/index.js';
import { useGetOpenContracts } from '../../../../hooks/use-get-all-contracts.js';
import { useIssueMonthlyDocuments } from '../../../../hooks/use-issue-monthly-documents.js';
import { ConfirmationModal, NumberInput } from '../../../common/index.js';
import { Button } from '../../../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../../ui/form.js';
import { Label } from '../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';
import { AddDocumentToIssue } from './add-document-to-issue.js';

export type IssueDocumentsVariables = Omit<
  IssueMonthlyDocumentsMutationVariables,
  'generateDocumentsInfo'
> & {
  generateDocumentsInfo: NewDocumentInput[];
};

type IssueDocumentsTableProps = {
  drafts: FragmentType<typeof NewDocumentInfoFragmentDoc>[];
};

export const IssueDocumentsTable = ({ drafts }: IssueDocumentsTableProps): ReactElement => {
  const documentDrafts = drafts.map(draft =>
    getFragmentData(NewDocumentInfoFragmentDoc, draft),
  ) as (Omit<NewDocumentInfoFragment, 'client'> & {
    client: NewDocumentInfoFragment['client'] & { id: string };
  })[];

  const defaultIssueMonth = format(subMonths(new Date(), 1), 'yyyy-MM-dd') as TimelessDateString;

  const form = useForm<IssueDocumentsVariables>({
    values: {
      generateDocumentsInfo: documentDrafts,
    },
    defaultValues: {
      issueMonth: defaultIssueMonth,
    },
  });
  const { issueDocuments } = useIssueMonthlyDocuments();
  const { openContracts } = useGetOpenContracts();

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'generateDocumentsInfo',
  });

  const watchFieldArray = form.watch('generateDocumentsInfo');
  const controlledFields = useMemo(
    () =>
      fields.map((field, index) => {
        return {
          ...field,
          ...watchFieldArray[index],
          id: field.client?.id,
        };
      }),
    [fields, watchFieldArray],
  );

  const onSubmit = useCallback(
    (data: IssueDocumentsVariables) => {
      issueDocuments(data);
    },
    [issueDocuments],
  );

  const unusedContracts = useMemo(
    () =>
      openContracts.filter(
        openContract =>
          openContract.billingCycle === BillingCycle.Monthly &&
          !controlledFields.some(
            controlled => controlled.client?.id === openContract.client.originalBusiness.id,
          ),
      ),
    // .sort((a, b) => a.client?.name.localeCompare(b.client?.name)),
    [controlledFields, openContracts],
  );

  return (
    <div className="p-2">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* date input for issueMonth */}
          <div className="flex gap-2 items-center mb-4">
            <Label>Issue Month:</Label>
            <FormField
              control={form.control}
              name="issueMonth"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <MonthPickerInput
                      {...field}
                      value={field.value ? new Date(field.value) : new Date()}
                      onChange={(date: Date) => {
                        const month = new Date(date.getFullYear(), date.getMonth(), 15);
                        form.setValue(
                          'issueMonth',
                          format(month, 'yyyy-MM-dd') as TimelessDateString,
                        );
                      }}
                      error={fieldState.error?.message}
                      popoverProps={{ withinPortal: true }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Green Invoice ID</TableHead>
                <TableHead>Local ID</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {controlledFields.map((row, index) => {
                const draft = documentDrafts.find(draft => draft.client.id === row.id);
                if (!draft) {
                  return null;
                }
                console.log(getFragmentData(IssueDocumentClientFieldsFragmentDoc, draft.client));
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      {getFragmentData(IssueDocumentClientFieldsFragmentDoc, draft.client).name}
                    </TableCell>
                    <TableCell>{draft.type}</TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`generateDocumentsInfo.${index}.income.0.price`}
                        render={({ field }) => (
                          <FormItem>
                            <NumberInput
                              onValueChange={field.onChange}
                              value={field.value ?? undefined}
                              hideControls
                              decimalScale={2}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`generateDocumentsInfo.${index}.income.0.currency`}
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a recipient" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.entries(Currency).map(([key, value]) => (
                                  <SelectItem key={key} value={value}>
                                    {key}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500 whitespace-normal max-w-50">
                        {draft.remarks}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {getFragmentData(
                          IssueDocumentClientFieldsFragmentDoc,
                          draft.client,
                        ).emails?.map(email => (
                          <span key={email} className="text-sm text-gray-500">
                            {email}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500 whitespace-normal max-w-50">
                        {row.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Button variant="secondary" onClick={() => remove(index)}>
                          <X size={16} />
                        </Button>
                        <Button variant="secondary" onClick={() => remove(index)}>
                          <X size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center mt-4">
            <AddDocumentToIssue
              contracts={unusedContracts}
              onAdd={append}
              issueMonth={form.getValues('issueMonth') ?? defaultIssueMonth}
            />
            <ConfirmationModal
              onConfirm={form.handleSubmit(onSubmit)}
              title={`Are you sure you want to issue ${controlledFields.length} documents?`}
            >
              <Button>Issue</Button>
            </ConfirmationModal>
          </div>
        </form>
      </Form>
    </div>
  );
};
