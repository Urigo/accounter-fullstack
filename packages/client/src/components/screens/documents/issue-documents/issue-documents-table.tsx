import { ReactElement, useCallback, useContext, useEffect, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { X } from 'lucide-react';
import { TimelessDateString } from 'packages/client/src/helpers/index.js';
import { useFieldArray, useForm } from 'react-hook-form';
import { MonthPickerInput } from '@mantine/dates';
import {
  AllGreenInvoiceBusinessesQuery,
  Currency,
  GenerateDocumentInfo,
  IssueMonthlyDocumentsMutationVariables,
} from '../../../../gql/graphql.js';
import { useIssueMonthlyDocuments } from '../../../../hooks/use-issue-monthly-documents.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
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
import { DownloadCSV } from './download-csv.js';
import { UploadCsv } from './upload-csv.js';

export type IssueDocumentsVariables = Omit<
  IssueMonthlyDocumentsMutationVariables,
  'generateDocumentsInfo'
> & {
  generateDocumentsInfo: GenerateDocumentInfo[];
};

type IssueDocumentsTableProps = {
  businessesData: AllGreenInvoiceBusinessesQuery['greenInvoiceBusinesses'];
};

export const IssueDocumentsTable = ({ businessesData }: IssueDocumentsTableProps): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const form = useForm<IssueDocumentsVariables>({
    defaultValues: {
      generateDocumentsInfo: [],
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

  const unusedBusinesses = useMemo(
    () =>
      businessesData
        .filter(
          business =>
            !controlledFields.some(
              controlled => controlled.businessId === business.originalBusiness.id,
            ),
        )
        .sort((a, b) => a.originalBusiness.name.localeCompare(b.originalBusiness.name)),
    [businessesData, controlledFields],
  );

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <DownloadCSV form={form} businessesData={businessesData} />
        <UploadCsv form={form} />
      </div>,
    );
  }, [form, businessesData, setFiltersContext]);

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
                const business = businessesData.find(
                  business => business.originalBusiness.id === row.businessId,
                );
                if (!business) {
                  return null;
                }
                return (
                  <TableRow key={row.id}>
                    <TableCell>{business.originalBusiness.name}</TableCell>
                    <TableCell>{business.generatedDocumentType}</TableCell>
                    {/* <TableCell>
                      <FormField
                        control={form.control}
                        name={`generateDocumentsInfo.${index}.generatedDocumentType`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.values(Currency).map(currency => (
                                  <SelectItem key={currency} value={currency}>
                                    {currency}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell> */}
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
                        {business.remark}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {business.emails.map(email => (
                          <span key={email} className="text-sm text-gray-500">
                            {email}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{business.greenInvoiceId}</TableCell>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>
                      <Button variant="secondary" onClick={() => remove(index)}>
                        <X size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center mt-4">
            <AddDocumentToIssue greenInvoiceBusinesses={unusedBusinesses} onAdd={append} />
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
