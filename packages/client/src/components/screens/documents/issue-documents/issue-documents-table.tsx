import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { format, subMonths } from 'date-fns';
import { X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { MonthPickerInput } from '@mantine/dates';
import { getFragmentData, type FragmentType } from '../../../../gql/fragment-masking.js';
import {
  AllOpenContractsDocument,
  BillingCycle,
  MonthlyDocumentsDraftsDocument,
  NewDocumentInfoFragmentDoc,
  type IssueMonthlyDocumentsMutationVariables,
  type NewDocumentInfoFragment,
  type NewDocumentInput,
} from '../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../helpers/index.js';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/tooltip.js';
import { AddDocumentToIssue } from './add-document-to-issue.js';
import { EditIssueDocumentModal } from './edit-issue-document-modal.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllOpenContracts {
    allOpenContracts {
      id
      client {
        id
        originalBusiness {
          id
          name
        }
      }
      billingCycle
    }
  }
`;

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

  const [{ data: openContractsData }] = useQuery({
    query: AllOpenContractsDocument,
  });

  const { fields, append, remove, update } = useFieldArray({
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
      openContractsData?.allOpenContracts.filter(
        openContract =>
          openContract.billingCycle === BillingCycle.Monthly &&
          !controlledFields.some(
            controlled => controlled.client?.id === openContract.client.originalBusiness.id,
          ),
      ),
    // .sort((a, b) => a.client?.name.localeCompare(b.client?.name)),
    [controlledFields, openContractsData],
  );

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
                        <Tooltip>
                          <TooltipTrigger asChild type="button">
                            <Button
                              className="size-7.5"
                              variant="secondary"
                              onClick={() => remove(index)}
                            >
                              <X size={16} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Remove document</p>
                          </TooltipContent>
                        </Tooltip>
                        <EditIssueDocumentModal
                          draft={row}
                          onApprove={document => {
                            form.setValue(`generateDocumentsInfo.${index}`, document, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                            update(index, {
                              ...document,
                            });
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center mt-4">
            <AddDocumentToIssue
              clients={
                unusedContracts?.map(contract => ({
                  id: contract.client.originalBusiness.id,
                  name: contract.client.originalBusiness.name,
                })) ?? []
              }
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
