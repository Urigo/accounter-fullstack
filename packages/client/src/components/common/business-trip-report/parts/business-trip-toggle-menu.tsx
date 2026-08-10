import { useState, type ReactElement } from 'react';
import { HandCoins, MoreVertical } from 'lucide-react';
import { useCreditShareholdersBusinessTripTnS } from '../../../../hooks/use-credit-shareholders-business-trip-tns.js';
import { ConfirmationModal } from '../../../common/index.js';
import { Button } from '../../../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu.js';

interface Props {
  businessTripId: string;
}

export function BusinessTripToggleMenu({ businessTripId }: Props): ReactElement {
  const [confirmCreditOpen, setConfirmCreditOpen] = useState(false);
  const { creditShareholders } = useCreditShareholdersBusinessTripTnS();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Business trip actions"
            onClick={event => event.stopPropagation()}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-50"
          onClick={event => event.stopPropagation()}
        >
          <DropdownMenuLabel variant="section">Summarize Trip</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setConfirmCreditOpen(true)}>
            <HandCoins className="size-4" />
            Credit surplus T&S
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationModal
        open={confirmCreditOpen}
        setOpen={setConfirmCreditOpen}
        onConfirm={() => {
          creditShareholders({ businessTripId });
        }}
        title="Credit shareholders with travel and subsistence surplus?"
      />
    </>
  );
}
