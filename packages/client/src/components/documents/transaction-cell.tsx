import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import {
  DocumentsScreenQuery,
  SuggestDocumentMatchingTransactionsDocument,
} from '../../gql/graphql.js';
import { useUpdateDocument } from '../../hooks/use-update-document.js';
import { AccounterTable } from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';

type TransactionMatch = {
  id: string;
  eventDate: string;
  sourceDescription: string;
  effectiveDate?: string;
  amount: { formatted: string };
  chargeId: string;
};

export const TransactionCell = ({
  row,
}: {
  row: {
    original: DocumentsScreenQuery['documentsByFilters'][number];
  };
}) => {
  const [{ data, fetching }, suggestMatches] = useQuery({
    query: SuggestDocumentMatchingTransactionsDocument,
    variables: { documentId: row.original.id },
    pause: true,
  });
  const { updateDocument } = useUpdateDocument();
  const [suggestedMatches, setSuggestedMatches] = useState<TransactionMatch[]>([]);
  const [showMatchesDialog, setShowMatchesDialog] = useState(false);

  useEffect(() => {
    if (data?.suggestDocumentMatchingTransactions) {
      setSuggestedMatches(data.suggestDocumentMatchingTransactions as TransactionMatch[]);
      setShowMatchesDialog(true);
    }
  }, [data]);

  const handleSelectMatch = async (chargeId: string) => {
    // Update the document with the selected match's charge ID
    const result = await updateDocument({
      documentId: row.original.id,
      fields: { chargeId },
    });

    if (result && 'message' in result) {
      toast.error('Error updating document', {
        description:
          (result.message as string) || 'Failed to update document with selected transaction',
      });
    } else {
      setShowMatchesDialog(false);
      setSuggestedMatches([]);
    }
  };

  return (
    <>
      {row.original.charge?.transactions?.[0]?.id ? (
        <AccounterTable
          items={row.original.charge?.transactions ?? []}
          columns={[
            {
              title: 'Transaction Amount',
              value: transaction => transaction?.amount.formatted,
            },
            {
              title: 'Transaction Created At',
              value: transaction =>
                transaction?.eventDate ? format(new Date(transaction.eventDate), 'dd/MM/yy') : null,
            },
            {
              title: 'Transaction Effective Date',
              value: transaction =>
                transaction?.effectiveDate
                  ? format(new Date(transaction.effectiveDate), 'dd/MM/yy')
                  : null,
            },
            {
              title: 'Transaction Description',
              value: transaction => transaction?.sourceDescription,
            },
          ]}
        />
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={suggestMatches} disabled={fetching}>
            {fetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Match with AI
          </Button>
          No Related Transaction
        </div>
      )}
      <SuggestedMatchesDialog
        open={showMatchesDialog}
        onOpenChange={setShowMatchesDialog}
        matches={suggestedMatches}
        onSelectMatch={handleSelectMatch}
      />
    </>
  );
};

const SuggestedMatchesDialog = ({
  open,
  onOpenChange,
  matches,
  onSelectMatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: TransactionMatch[];
  onSelectMatch: (chargeId: string) => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Suggested Matches</DialogTitle>
          <DialogDescription>Select a transaction to link with this document</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {matches.map(match => (
            <div key={match.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="font-medium">{match.sourceDescription}</div>
                <div className="text-sm text-gray-500">
                  {match.eventDate && `Created: ${format(new Date(match.eventDate), 'dd/MM/yy')}`}
                  {match.effectiveDate &&
                    ` • Effective: ${format(new Date(match.effectiveDate), 'dd/MM/yy')}`}
                </div>
                <div className="text-sm font-medium">{match.amount?.formatted}</div>
              </div>
              <Button variant="outline" onClick={() => onSelectMatch(match.chargeId)}>
                Select
              </Button>
            </div>
          ))}
          {matches.length === 0 && (
            <div className="text-center py-4 text-gray-500">No matches found</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
