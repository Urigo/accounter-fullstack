import { useContext, useState, type JSX } from 'react';
import { CircleCheckBig, FileDown, User2Icon } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import { useDisclosure } from '@mantine/hooks';
import { useCornJobs } from '../../hooks/use-corn-jobs.js';
import { UserContext } from '../../providers/index.js';
import { ConfirmationModal, LogoutButton, SyncDocumentsModal, Tooltip } from '../common/index.js';
import { BalanceChargeModal } from '../common/modals/balance-charge-modal.js';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';

export function UserNav(): JSX.Element | null {
  const { userContext } = useContext(UserContext);
  const { isAuthenticated, user } = useAuth0();
  const [pullDocumentsOpened, { close: closePullDocuments, open: openPullDocuments }] =
    useDisclosure(false);
  const [balanceChargeModalOpen, setBalanceChargeModalOpen] = useState(false);
  const { executeJobs } = useCornJobs();

  if (!isAuthenticated || !user) {
    return null;
  }

  const userName = user.name ?? user.email ?? userContext?.username ?? 'User';
  const userEmail = user.email ?? 'No email';
  const initials = userName
    .split(' ')
    .map(namePart => namePart[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const rawUser = user as Record<string, unknown>;
  const roleFromClaim = ((): string | null => {
    if (typeof rawUser['https://accounter.app/role'] === 'string') {
      return rawUser['https://accounter.app/role'];
    }
    if (typeof rawUser.role === 'string') {
      return rawUser.role;
    }
    if (
      Array.isArray(rawUser['https://accounter.app/roles']) &&
      rawUser['https://accounter.app/roles'].length > 0
    ) {
      return String(rawUser['https://accounter.app/roles'][0]);
    }
    if (Array.isArray(rawUser.roles) && rawUser.roles.length > 0) {
      return String(rawUser.roles[0]);
    }
    return null;
  })();

  const roleLabel = (roleFromClaim ?? (userContext?.context.adminBusinessId ? 'admin' : 'member'))
    .split(/[_-]/g)
    .map(part => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8 items-center flex flex-row justify-center">
              <AvatarImage src={user.picture} alt={userName} />
              <AvatarFallback>{initials || <User2Icon size={20} />}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{userName}</p>
              <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
              <p className="text-xs leading-none text-muted-foreground">Role: {roleLabel}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Button variant="ghost" onClick={() => setBalanceChargeModalOpen(true)}>
              Add Balance Charge
            </Button>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Tooltip content="Pull Green Invoice Documents">
              <Button variant="ghost" size="icon" className="size-7.5" onClick={openPullDocuments}>
                <FileDown className="size-5" />
              </Button>
            </Tooltip>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Tooltip content="Execute corn jobs">
              <ConfirmationModal
                onConfirm={executeJobs}
                title="Are you sure you want to manually execute corn jobs?"
              >
                <Button variant="ghost" size="icon" className="size-7.5">
                  <CircleCheckBig className="size-5" />
                </Button>
              </ConfirmationModal>
            </Tooltip>
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
