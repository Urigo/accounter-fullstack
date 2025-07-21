import { JSX, useState } from 'react';
import { CircleCheckBig, FileDown, User2Icon } from 'lucide-react';
import { Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useCornJobs } from '../../hooks/use-corn-jobs.js';
import { ConfirmationModal, LogoutButton, PullDocumentsModal } from '../common/index.js';
import { BalanceChargeModal } from '../common/modals/balance-charge-modal.js';
import { Avatar } from '../ui/avatar.js';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';

export function UserNav(): JSX.Element {
  const [pullDocumentsOpened, { close: closePullDocuments, open: openPullDocuments }] =
    useDisclosure(false);
  const [balanceChargeModalOpen, setBalanceChargeModalOpen] = useState(false);
  const { executeJobs } = useCornJobs();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8 items-center flex flex-row justify-center">
              <User2Icon size={20} />
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">User Name</p>
              <p className="text-xs leading-none text-muted-foreground">Email</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Button variant="ghost" onClick={() => setBalanceChargeModalOpen(true)}>
              Add Balance Charge
            </Button>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Tooltip label="Pull Green Invoice Documents">
              <Button variant="ghost" size="icon" className="size-7.5" onClick={openPullDocuments}>
                <FileDown className="size-5" />
              </Button>
            </Tooltip>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <ConfirmationModal
              onConfirm={executeJobs}
              title="Are you sure you want to manually execute corn jobs?"
            >
              <Tooltip label="Execute corn jobs">
                <Button variant="ghost" size="icon" className="size-7.5">
                  <CircleCheckBig className="size-5" />
                </Button>
              </Tooltip>
            </ConfirmationModal>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LogoutButton />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PullDocumentsModal close={closePullDocuments} opened={pullDocumentsOpened} />

      <BalanceChargeModal
        open={balanceChargeModalOpen}
        onOpenChange={setBalanceChargeModalOpen}
        onClose={() => setBalanceChargeModalOpen(false)}
      />
    </>
  );
}
