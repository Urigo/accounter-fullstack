import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactElement,
} from 'react';
import { format, subMonths } from 'date-fns';
import { X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { AccounterLoader } from '@/components/common/loader.js';
import {
  ContractBasedDocumentDraftsDocument,
  NewDocumentInfoFragmentDoc,
  type NewDocumentInfoFragment,
} from '@/gql/graphql.js';
import { getFragmentData } from '@/gql/index.js';
import type { TimelessDateString } from '@/helpers/dates.js';
import { useIssueMonthlyDocuments } from '@/hooks/use-issue-monthly-documents.js';
import { MonthPickerInput } from '@mantine/dates';
import { ConfirmationModal } from '../common/index.js';
import { EditIssueDocumentModal } from '../screens/documents/issue-documents/edit-issue-document-modal.js';
import { type IssueDocumentsVariables } from '../screens/documents/issue-documents/issue-documents-table.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog.js';
import { Form } from '../ui/form.js';
import { Label } from '../ui/label.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ContractBasedDocumentDrafts($issueMonth: TimelessDate!, $contractIds: [UUID!]!) {
    clientChargesDraftsByContracts(issueMonth: $issueMonth, contractIds: $contractIds) {
      ...NewDocumentInfo
    }
  }
`;

type Props = ComponentProps<typeof Button> & {
  contractIds: string[];
};

export const IssueDocumentsModal = ({ contractIds }: Props): ReactElement => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [issueMonth, setIssueMonth] = useState<TimelessDateString>(
    format(subMonths(new Date(), 1), 'yyyy-MM-dd') as TimelessDateString,
  );
  const [documentDrafts, setDocumentDrafts] = useState<
    (Omit<NewDocumentInfoFragment, 'client'> & {
      client: NewDocumentInfoFragment['client'] & { id: string };
    })[]
  >([]);
  const { issueDocuments } = useIssueMonthlyDocuments();

  const [{ data, fetching }, fetchDrafts] = useQuery({
    query: ContractBasedDocumentDraftsDocument,
    variables: {
      issueMonth,
      contractIds,
    },
    pause: !isDialogOpen,
  });
  useEffect(() => {
    if (data?.clientChargesDraftsByContracts) {
      setDocumentDrafts(
        data.clientChargesDraftsByContracts.map(draft =>
          getFragmentData(NewDocumentInfoFragmentDoc, draft),
        ) as (Omit<NewDocumentInfoFragment, 'client'> & {
          client: NewDocumentInfoFragment['client'] & { id: string };
        })[],
      );
    }
  }, [data, setDocumentDrafts]);

  useEffect(() => {
    if (isDialogOpen) {
      void fetchDrafts();
    }
  }, [isDialogOpen, fetchDrafts]);

  const form = useForm<IssueDocumentsVariables>({
    values: {
      generateDocumentsInfo: documentDrafts,
    },
  });

  const onSubmit = useCallback(
    (data: IssueDocumentsVariables) => {
      issueDocuments(data);
    },
    [issueDocuments],
  );

  const { fields, remove, update } = useFieldArray({
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

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={contractIds.length === 0}>
          Issue Documents
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-[90vw] w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter Contracts</DialogTitle>
          <DialogDescription>Filter contracts based on various criteria</DialogDescription>
        </DialogHeader>
        {fetching ? (
          <AccounterLoader />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="min-w-5xl w-full">
              {/* date input for issueMonth */}
              <div className="flex gap-2 items-center mb-4">
                <Label>Issue Month:</Label>
                <MonthPickerInput
                  value={new Date(issueMonth)}
                  onChange={(date: Date) => {
                    const month = new Date(date.getFullYear(), date.getMonth(), 15);
                    setIssueMonth(format(month, 'yyyy-MM-dd') as TimelessDateString);
                  }}
                  popoverProps={{ withinPortal: false }}
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
                <ConfirmationModal
                  onConfirm={form.handleSubmit(onSubmit)}
                  title={`Are you sure you want to issue ${controlledFields.length} documents?`}
                >
                  <Button>Issue</Button>
                </ConfirmationModal>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
