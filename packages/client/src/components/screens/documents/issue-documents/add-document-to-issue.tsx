import { ReactElement, useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { UseFieldArrayAppend } from 'react-hook-form';
import { useQuery } from 'urql';
import {
  MonthlyDocumentDraftByClientDocument,
  NewDocumentInfoFragmentDoc,
} from '../../../../gql/graphql.js';
import { getFragmentData } from '../../../../gql/index.js';
import { TimelessDateString } from '../../../../helpers/index.js';
import { AllOpenContracts } from '../../../../hooks/use-get-all-contracts.js';
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
import { IssueDocumentsVariables } from './issue-documents-table.js';

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
  contracts,
  onAdd,
}: {
  issueMonth: TimelessDateString;
  contracts: AllOpenContracts;
  onAdd: UseFieldArrayAppend<IssueDocumentsVariables, 'generateDocumentsInfo'>;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>('');

  const [{ data }, fetchDraft] = useQuery({
    query: MonthlyDocumentDraftByClientDocument,
    variables: {
      issueMonth,
      clientId,
    },
  });

  const onSelect = useCallback(
    (clientId: string) => {
      setClientId(clientId);
      fetchDraft();
      console.log('Fetching draft for client ID:', clientId);
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
            {contracts.map(contract => (
              <SelectItem
                key={contract.client.originalBusiness.id}
                value={contract.client.originalBusiness.id}
              >
                {contract.client.originalBusiness.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogContent>
    </Dialog>
  );
}
