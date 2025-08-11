import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { MonthPickerInput } from '@mantine/dates';
import { FragmentType, getFragmentData } from '../../../../gql/fragment-masking.js';
import {
  BillingCycle,
  IssueMonthlyDocumentsMutationVariables,
  MonthlyDocumentsDraftsDocument,
  NewDocumentInfoFragment,
  NewDocumentInfoFragmentDoc,
  NewDocumentInput,
} from '../../../../gql/graphql.js';
import { TimelessDateString } from '../../../../helpers/index.js';
import { useGetOpenContracts } from '../../../../hooks/use-get-all-contracts.js';
import { useIssueMonthlyDocuments } from '../../../../hooks/use-issue-monthly-documents.js';
import { ConfirmationModal } from '../../../common/index.js';
import { Button } from '../../../ui/button.js';
import { Form } from '../../../ui/form.js';
import { Label } from '../../../ui/label.js';
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
  const [documentDrafts, setDocumentDrafts] = useState(
    drafts.map(draft => getFragmentData(NewDocumentInfoFragmentDoc, draft)) as (Omit<
      NewDocumentInfoFragment,
      'client'
    > & {
      client: NewDocumentInfoFragment['client'] & { id: string };
    })[],
  );

  const defaultIssueMonth = format(subMonths(new Date(), 1), 'yyyy-MM-dd') as TimelessDateString;

  const [issueMonth, setIssueMonth] = useState<TimelessDateString>(defaultIssueMonth);

  const [{ data }, fetchNewDrafts] = useQuery({
    query: MonthlyDocumentsDraftsDocument,
    variables: {
      issueMonth,
    },
    pause: true,
  });

  useEffect(() => {
    if (data?.clientMonthlyChargesDrafts) {
      setDocumentDrafts(
        data.clientMonthlyChargesDrafts.map(draft =>
          getFragmentData(NewDocumentInfoFragmentDoc, draft),
        ) as (Omit<NewDocumentInfoFragment, 'client'> & {
          client: NewDocumentInfoFragment['client'] & { id: string };
        })[],
      );
    }
  }, [data, setDocumentDrafts]);

  useEffect(() => {
    fetchNewDrafts();
  }, [issueMonth, fetchNewDrafts]);

  const form = useForm<IssueDocumentsVariables>({
    values: {
      generateDocumentsInfo: documentDrafts,
    },
  });
  const { issueDocuments } = useIssueMonthlyDocuments();
  const { openContracts } = useGetOpenContracts();

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'generateDocumentsInfo',
  });

  const watchFieldArray = form.watch('generateDocumentsInfo');
  const controlledFields = useMemo(() => {
    return fields.map((field, index) => {
      return {
        ...field,
        ...watchFieldArray[index],
        id: field.client?.id,
      };
    });
  }, [fields, watchFieldArray]);

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

  console.log(form.getValues('generateDocumentsInfo'));

  return (
    <div className="p-2">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* date input for issueMonth */}
          <div className="flex gap-2 items-center mb-4">
            <Label>Issue Month:</Label>
            <MonthPickerInput
              value={new Date(issueMonth)}
              onChange={(date: Date) => {
                const month = new Date(date.getFullYear(), date.getMonth(), 15);
                setIssueMonth(format(month, 'yyyy-MM-dd') as TimelessDateString);
              }}
              popoverProps={{ withinPortal: true }}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {controlledFields.map(({ id, ...row }, index) => {
                return (
                  <TableRow key={id}>
                    <TableCell>{row.client?.name}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>
                      {row.income?.[0]?.price} {row.income?.[0]?.currency}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500 whitespace-normal max-w-50">
                        {row.remarks}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {row.client?.emails?.map(email => (
                          <span key={email} className="text-sm text-gray-500">
                            {email}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Button variant="secondary" onClick={() => remove(index)}>
                          <X size={16} />
                        </Button>
                        {/* <PreviewDocumentModal
                          initialFormData={{
                            ...row,
                            description: row.description || undefined,
                            remarks: row.remarks || undefined,
                            footer: row.footer || undefined,
                            date: row.date || undefined,
                            dueDate: row.dueDate || undefined,
                            discount: row.discount || undefined,
                            rounding: row.rounding || undefined,
                            signed: row.signed || undefined,
                            maxPayments: row.maxPayments || undefined,
                            client: row.client ? normalizeClientInfo(row.client) : undefined,
                            income: row.income?.map(income => ({
                              ...income,
                              currencyRate: income.currencyRate ?? undefined,
                              itemId: income.itemId || undefined,
                              vatRate: income.vatRate ?? undefined,
                              amount: income.amount || undefined,
                              amountTotal: income.amountTotal || undefined,
                              catalogNum: income.catalogNum || undefined,
                              vat: income.vat || undefined,
                            })),
                            payment: row.payment?.map(payment => ({
                              ...payment,
                              currencyRate: payment.currencyRate || undefined,
                              date: payment.date || undefined,
                              subType: payment.subType || undefined,
                              bankName: payment.bankName || undefined,
                              bankBranch: payment.bankBranch || undefined,
                              bankAccount: payment.bankAccount || undefined,
                              chequeNum: payment.chequeNum || undefined,
                              accountId: payment.accountId || undefined,
                              transactionId: payment.transactionId || undefined,
                              appType: payment.appType || undefined,
                              cardType: payment.cardType || undefined,
                              cardNum: payment.cardNum || undefined,
                              dealType: payment.dealType || undefined,
                              numPayments: payment.numPayments || undefined,
                              firstPayment: payment.firstPayment || undefined,
                            })),
                            linkedDocumentIds: row.linkedDocumentIds || undefined,
                            linkedPaymentId: row.linkedPaymentId || undefined,
                            linkType: row.linkType || undefined,
                            type: row.type,
                          }}
                          documentType={row.type}
                          trigger={
                            <Button variant="secondary">
                              <Edit size={16} />
                            </Button>
                          }
                          onDone={draft => {
                            form.setValue(`generateDocumentsInfo.${index}`, draft, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                          }}
                        /> */}
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
              issueMonth={issueMonth}
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
