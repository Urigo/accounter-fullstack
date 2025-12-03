import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Plus } from 'lucide-react';
import type { UseFieldArrayAppend } from 'react-hook-form';
import { useQuery } from 'urql';
import {
  MonthlyDocumentDraftByClientDocument,
  NewDocumentInfoFragmentDoc,
  type NewDocumentInfoFragment,
} from '../../../../gql/graphql.js';
import { getFragmentData } from '../../../../gql/index.js';
import type { TimelessDateString } from '../../../../helpers/index.js';
import { Button } from '../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query MonthlyDocumentDraftByClient($clientId: UUID!, $issueMonth: TimelessDate!) {
    clientMonthlyChargeDraft(clientId: $clientId, issueMonth: $issueMonth) {
      ...NewDocumentInfo
    }
  }
`;

export function AddDocumentToIssue({
  issueMonth,
  clients,
  onAdd,
}: {
  issueMonth: TimelessDateString;
  clients: { id: string; name: string }[];
  onAdd: UseFieldArrayAppend<
    {
      generateDocumentsInfo: NewDocumentInfoFragment[];
    },
    'generateDocumentsInfo'
  >;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>('');

  const [{ data }, fetchDraft] = useQuery({
    query: MonthlyDocumentDraftByClientDocument,
    variables: {
      issueMonth,
      clientId,
    },
    pause: !open,
  });

  const onSelect = useCallback(
    (clientId: string) => {
      setClientId(clientId);
      fetchDraft();
    },
    [fetchDraft, setClientId],
  );

  useEffect(() => {
    if (clientId !== '' && data) {
      onAdd(getFragmentData(NewDocumentInfoFragmentDoc, data.clientMonthlyChargeDraft));
      setOpen(false);
    }
  }, [clientId, data, onAdd]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Plus />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[400px] max-w-screen-md">
        <DialogHeader>
          <DialogTitle>Select document recipient</DialogTitle>
        </DialogHeader>
        <Select onValueChange={onSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Recipient" />
          </SelectTrigger>
          <SelectContent>
            {clients.map(client => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogContent>
    </Dialog>
  );
}
