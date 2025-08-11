import { ReactElement, useCallback, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { MonthPickerInput } from '@mantine/dates';
import {
  AllOpenContractsQuery,
  BillingCycle,
  Currency,
  GenerateDocumentInfo,
  IssueMonthlyDocumentsMutationVariables,
} from '../../../../gql/graphql.js';
import { TimelessDateString } from '../../../../helpers/index.js';
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
  generateDocumentsInfo: GenerateDocumentInfo[];
};

type IssueDocumentsTableProps = {
  contracts: AllOpenContractsQuery['allOpenContracts'];
};

export const IssueDocumentsTable = ({ contracts }: IssueDocumentsTableProps): ReactElement => {
  const form = useForm<IssueDocumentsVariables>({
    values: {
      generateDocumentsInfo: contracts
        .filter(c => c.billingCycle === BillingCycle.Monthly)
        .map(contract => ({
          amount: { raw: contract.amount.raw, currency: contract.amount.currency },
          businessId: contract.client.originalBusiness.id,
        })),
    },
    defaultValues: {
      issueMonth: format(subMonths(new Date(), 1), 'yyyy-MM-dd') as TimelessDateString,
    },
  });
  const { issueDocuments } = useIssueMonthlyDocuments();

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
      contracts
        .filter(
          contract =>
            !controlledFields.some(
              controlled => controlled.businessId === contract.client.originalBusiness.id,
            ),
        )
        .sort((a, b) =>
          a.client.originalBusiness.name.localeCompare(b.client.originalBusiness.name),
        ),
    [contracts, controlledFields],
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
                const contract = contracts.find(
                  contract => contract.client.originalBusiness.id === row.businessId,
                );
                if (!contract) {
                  return null;
                }
                return (
                  <TableRow key={row.id}>
                    <TableCell>{contract.client.originalBusiness.name}</TableCell>
                    <TableCell>{contract.documentType}</TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`generateDocumentsInfo.${index}.amount.raw`}
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
                        name={`generateDocumentsInfo.${index}.amount.currency`}
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
                        {`${contract.purchaseOrder ? `PO: ${contract.purchaseOrder}${contract.remarks ? ', ' : ''}` : ''}${contract.remarks ?? ''}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {contract.client.emails.map(email => (
                          <span key={email} className="text-sm text-gray-500">
                            {email}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500 whitespace-normal max-w-50">
                        {contract.client.greenInvoiceId}
                      </span>
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
            <AddDocumentToIssue contracts={unusedContracts} onAdd={append} />
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
