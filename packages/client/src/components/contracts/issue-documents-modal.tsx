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
import { Link } from 'react-router-dom';
import { useQuery } from 'urql';
import { MonthPickerInput } from '@mantine/dates';
import {
  AccounterLoader,
  convertNewDocumentDraftFragmentIntoPreviewDocumentInput,
  type PreviewDocumentInput,
} from '@/components/common/index.js';
import { ContractBasedDocumentDraftsDocument, NewDocumentDraftFragmentDoc } from '@/gql/graphql.js';
import { getFragmentData } from '@/gql/index.js';
import type { TimelessDateString } from '@/helpers/dates.js';
import { useIssueMonthlyDocuments } from '@/hooks/use-issue-monthly-documents.js';
import { ROUTES } from '@/router/routes.js';
import { ConfirmationModal } from '../common/index.js';
import { EditIssueDocumentModal } from '../screens/documents/issue-documents/edit-issue-document-modal.js';
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
    periodicalDocumentDraftsByContracts(issueMonth: $issueMonth, contractIds: $contractIds) {
      ...NewDocumentDraft
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
  const [documentDrafts, setDocumentDrafts] = useState<PreviewDocumentInput[]>([]);
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
    if (data?.periodicalDocumentDraftsByContracts) {
      setDocumentDrafts(
        data.periodicalDocumentDraftsByContracts.map(draft =>
          convertNewDocumentDraftFragmentIntoPreviewDocumentInput(
            getFragmentData(NewDocumentDraftFragmentDoc, draft),
          ),
        ),
      );
    }
  }, [data, setDocumentDrafts]);

  useEffect(() => {
    if (isDialogOpen) {
      void fetchDrafts();
    }
  }, [isDialogOpen, fetchDrafts]);

  const form = useForm<{ drafts: PreviewDocumentInput[] }>({
    values: {
      drafts: documentDrafts,
    },
  });

  const onSubmit = useCallback(
    async (data: { drafts: PreviewDocumentInput[] }) => {
      await issueDocuments({
        generateDocumentsInfo: data.drafts,
      });
      setIsDialogOpen(false);
    },
    [issueDocuments],
  );

  const { fields, remove, update } = useFieldArray({
    control: form.control,
    name: 'drafts',
  });

  const watchFieldArray = form.watch('drafts');

  const controlledFields = useMemo(() => {
    return fields.map((field, index) => {
      return {
        ...field,
        ...watchFieldArray[index],
        id: field.id,
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
          <DialogTitle>Issue Documents for Contracts</DialogTitle>
          <DialogDescription>
            Review and issue monthly documents for the selected contracts
          </DialogDescription>
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
                        <TableCell>
                          <Link
                            to={
                              row.client?.id
                                ? ROUTES.BUSINESSES.DETAIL(row.client?.id)
                                : ROUTES.BUSINESSES.ALL
                            }
                            target="_blank"
                            rel="noreferrer"
                            onClick={event => event.stopPropagation()}
                            className="inline-flex items-center font-semibold"
                          >
                            {row.client?.name}
                          </Link>
                        </TableCell>
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
                                form.setValue(`drafts.${index}`, document, {
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
