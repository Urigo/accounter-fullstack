import { ReactElement, useContext, useState } from 'react';
import { Plus } from 'lucide-react';
import { UseFieldArrayAppend } from 'react-hook-form';
import { AllGreenInvoiceBusinessesQuery, Currency } from '../../../../gql/graphql.js';
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
  greenInvoiceBusinesses,
  onAdd,
}: {
  greenInvoiceBusinesses: AllGreenInvoiceBusinessesQuery['greenInvoiceBusinesses'];
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
            const business = greenInvoiceBusinesses.find(b => b.originalBusiness.id === value);
            if (business) {
              onAdd({
                businessId: business.originalBusiness.id,
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
            {greenInvoiceBusinesses.map(business => (
              <SelectItem key={business.id} value={business.originalBusiness.id}>
                {business.originalBusiness.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogContent>
    </Dialog>
  );
}
