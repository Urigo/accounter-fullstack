import { useCallback, useEffect, useState, type ComponentProps, type ReactElement } from 'react';
import { format, subMonths } from 'date-fns';
import { Receipt } from 'lucide-react';
import { useQuery } from 'urql';
import {
  AccounterLoader,
  convertNewDocumentDraftFragmentIntoPreviewDocumentInput,
  type PreviewDocumentInput,
} from '@/components/common/index.js';
import { EditIssueDocumentContent } from '@/components/screens/documents/issue-documents/edit-issue-document-modal.js';
import { ContractBasedDocumentDraftDocument, NewDocumentDraftFragmentDoc } from '@/gql/graphql.js';
import { getFragmentData } from '@/gql/index.js';
import type { TimelessDateString } from '@/helpers/dates.js';
import { useIssueMonthlyDocuments } from '@/hooks/use-issue-monthly-documents.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ContractBasedDocumentDraft($issueMonth: TimelessDate!, $contractId: UUID!) {
    periodicalDocumentDraftsByContracts(issueMonth: $issueMonth, contractIds: [$contractId]) {
      ...NewDocumentDraft
    }
  }
`;

type Props = ComponentProps<typeof Button> & {
  contractId: string;
};

export const IssueDocumentFromContractModal = ({ contractId }: Props): ReactElement => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [documentDraft, setDocumentDraft] = useState<PreviewDocumentInput | undefined>(undefined);
  const { issueDocuments } = useIssueMonthlyDocuments();
  const issueMonth = format(subMonths(new Date(), 1), 'yyyy-MM-dd') as TimelessDateString;

  const [{ data, fetching }, fetchDrafts] = useQuery({
    query: ContractBasedDocumentDraftDocument,
    variables: {
      issueMonth,
      contractId,
    },
    pause: !isDialogOpen,
  });

  useEffect(() => {
    if (isDialogOpen) {
      fetchDrafts();
    }
  }, [isDialogOpen, fetchDrafts]);

  useEffect(() => {
    if (data?.periodicalDocumentDraftsByContracts?.length) {
      const draft = convertNewDocumentDraftFragmentIntoPreviewDocumentInput(
        getFragmentData(NewDocumentDraftFragmentDoc, data.periodicalDocumentDraftsByContracts[0]),
      );
      setDocumentDraft(draft);
    }
  }, [data, setDocumentDraft]);

  const onSubmit = useCallback(
    async (draft: PreviewDocumentInput) => {
      await issueDocuments({
        generateDocumentsInfo: [draft],
      });
      setIsDialogOpen(false);
    },
    [issueDocuments],
  );

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="size-7.5" variant="ghost">
          <Receipt className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] sm:max-w-[95%] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue Document for Contract</DialogTitle>
          <DialogDescription>Issue periodically documents based on contract</DialogDescription>
        </DialogHeader>
        {fetching ? (
          <AccounterLoader />
        ) : documentDraft ? (
          <EditIssueDocumentContent draft={documentDraft} onApprove={onSubmit} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
