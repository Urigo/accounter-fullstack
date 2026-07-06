import { useContext, useState, type JSX } from 'react';
import { Banknote, CircleCheckBig, FileDown, KeyRound, Shield, User2Icon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useCornJobs } from '../../hooks/use-corn-jobs.js';
import { useFetchDeelDocuments } from '../../hooks/use-fetch-deel-documents.js';
import { UserContext } from '../../providers/index.js';
import { getBusinessScopeIds, setBusinessScope } from '../../providers/urql.js';
import { ROUTES } from '../../router/routes.js';
import { ConfirmationModal, LogoutButton, SyncDocumentsModal, Tooltip } from '../common/index.js';
import { MultiSelect } from '../common/inputs/multi-select.js';
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
  const [pullDocumentsOpened, setPullDocumentsOpened] = useState(false);
  const [balanceChargeModalOpen, setBalanceChargeModalOpen] = useState(false);
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>(getBusinessScopeIds);
  const { executeJobs } = useCornJobs();
  const { fetching: fetchingDeelDocuments, fetchDocuments: fetchDeelDocuments } =
    useFetchDeelDocuments();

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

  const businessOptions = (userContext?.context.memberships ?? []).map(m => ({
    value: m.businessId,
    label: m.businessName ?? 'Unknown',
    description: m.businessId,
  }));

  function handleBusinessScopeChange(ids: string[]): void {
    setSelectedBusinessIds(ids);
    setBusinessScope(ids);
  }

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
          {businessOptions.length > 1 && (
            <>
              <DropdownMenuLabel className="font-normal">
                <span className="text-xs text-muted-foreground">Business scope</span>
              </DropdownMenuLabel>
              <div className="px-2 pb-1">
                <MultiSelect
                  options={businessOptions}
                  defaultValue={selectedBusinessIds}
                  onValueChange={handleBusinessScopeChange}
                  placeholder="All businesses"
                  maxCount={2}
                  className="text-xs"
                />
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          {userContext?.context.adminBusinessId && (
            <>
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
              <DropdownMenuItem asChild>
                <Link to={ROUTES.BUSINESSES.AUTH_MANAGEMENT(userContext.context.adminBusinessId)}>
                  <KeyRound className="size-4" />
                  <span className="hidden sm:inline">Access Management</span>
                </Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem>
            <Button variant="ghost" onClick={() => setBalanceChargeModalOpen(true)}>
              Add Balance Charge
            </Button>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Tooltip content="Pull Deel Documents">
              <Button
                variant="ghost"
                size="icon"
                className="size-7.5"
                disabled={fetchingDeelDocuments}
                onClick={() => fetchDeelDocuments()}
              >
                <Banknote className="size-5" />
              </Button>
            </Tooltip>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Tooltip content="Pull Green Invoice Documents">
              <Button
                variant="ghost"
                size="icon"
                className="size-7.5"
                onClick={() => setPullDocumentsOpened(true)}
              >
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
      <SyncDocumentsModal
        close={() => setPullDocumentsOpened(false)}
        opened={pullDocumentsOpened}
      />

      <BalanceChargeModal
        open={balanceChargeModalOpen}
        onOpenChange={setBalanceChargeModalOpen}
        onClose={() => setBalanceChargeModalOpen(false)}
      />
    </>
  );
}
