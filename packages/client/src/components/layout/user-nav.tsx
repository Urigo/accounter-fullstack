import { useContext, useState, type JSX } from 'react';
import { CircleCheckBig, FileDown, Shield, User2Icon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { UserContext } from '@/providers/index.js';
import { ROUTES } from '@/router/routes.js';
import { useCornJobs } from '../../hooks/use-corn-jobs.js';
import { ConfirmationModal, LogoutButton, SyncDocumentsModal } from '../common/index.js';
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
  const { userContext } = useContext(UserContext);
  const [pullDocumentsOpened, { close: closePullDocuments, open: openPullDocuments }] =
    useDisclosure(false);
  const [balanceChargeModalOpen, setBalanceChargeModalOpen] = useState(false);
  const { executeJobs } = useCornJobs();

  const userName = userContext?.username || 'User Name';

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
              <p className="text-sm font-medium leading-none">{userName}</p>
              <p className="text-xs leading-none text-muted-foreground">Email</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {userContext?.context.adminBusinessId && (
            <DropdownMenuItem asChild>
              <Link
                to={{
                  pathname: ROUTES.BUSINESSES.DETAIL(userContext.context.adminBusinessId),
                  search: '?tab=admin',
                }}
              >
                <Shield className="size-4" />
                <span className="hidden sm:inline">Admin Configurations</span>
              </Link>
            </DropdownMenuItem>
          )}
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
      <SyncDocumentsModal close={closePullDocuments} opened={pullDocumentsOpened} />

      <BalanceChargeModal
        open={balanceChargeModalOpen}
        onOpenChange={setBalanceChargeModalOpen}
        onClose={() => setBalanceChargeModalOpen(false)}
      />
    </>
  );
}
