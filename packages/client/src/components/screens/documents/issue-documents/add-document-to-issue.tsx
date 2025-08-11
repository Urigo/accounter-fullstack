import { ReactElement, useContext, useState } from 'react';
import { Plus } from 'lucide-react';
import { UseFieldArrayAppend } from 'react-hook-form';
import { AllOpenContractsQuery, Currency } from '../../../../gql/graphql.js';
import { UserContext } from '../../../../providers/user-provider.js';
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

export function AddDocumentToIssue({
  contracts,
  onAdd,
}: {
  contracts: AllOpenContractsQuery['allOpenContracts'];
  onAdd: UseFieldArrayAppend<IssueDocumentsVariables, 'generateDocumentsInfo'>;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const { userContext } = useContext(UserContext);

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
        <Select
          onValueChange={value => {
            const contract = contracts.find(b => b.client.originalBusiness.id === value);
            if (contract) {
              onAdd({
                businessId: contract.client.originalBusiness.id,
                amount: {
                  raw: 0,
                  currency: userContext?.context.defaultCryptoConversionFiatCurrency as Currency,
                },
              });
              setOpen(false);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Recipient" />
          </SelectTrigger>
          <SelectContent>
            {contracts.map(contract => (
              <SelectItem key={contract.id} value={contract.client.originalBusiness.id}>
                {contract.client.originalBusiness.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogContent>
    </Dialog>
  );
}
