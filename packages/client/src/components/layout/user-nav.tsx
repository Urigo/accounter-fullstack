import { useContext, useState, type JSX } from 'react';
import { CircleCheckBig, FileDown, KeyRound, Shield, User2Icon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useMyMemberships } from '../../hooks/use-my-memberships.js';
import { UserContext } from '../../providers/index.js';
import { getBusinessScopeIds, setBusinessScope } from '../../providers/urql.js';
import { ROUTES } from '../../router/routes.js';
import { LogoutButton } from '../common/buttons/logout-button.js';
import { MultiSelect } from '../common/inputs/multi-select.js';
import { BalanceChargeModal } from '../common/modals/balance-charge-modal.js';
import { SyncDocumentsModal } from '../common/modals/sync-green-invoice-documents-modal.js';
import { Tooltip } from '../common/tooltip.js';
import { canRunManualAutomations } from '../manual-automations/manual-automations-access.js';
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

/** Same businesses in the same order. Order counts: the server picks the write target by it. */
function sameBusinessIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function UserNav(): JSX.Element | null {
  const { userContext } = useContext(UserContext);
  const { isAuthenticated, user } = useAuth0();
  const [pullDocumentsOpened, setPullDocumentsOpened] = useState(false);
  const [balanceChargeModalOpen, setBalanceChargeModalOpen] = useState(false);
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>(getBusinessScopeIds);
  // Scope-independent: `userContext.memberships` is fetched under the active
  // business scope, so it names only the in-scope businesses — leaving the rest
  // of this very picker as bare UUIDs. Skipped entirely when the picker could
  // not render anyway.
  const contextMemberships = userContext?.context.memberships ?? [];
  const { memberships: unscopedMemberships } = useMyMemberships({
    pause: contextMemberships.length < 2,
  });

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

  // Fall back while the unscoped query is in flight, or when it fails — its role
  // gate is narrower than this menu's audience. Both lists hold the same
  // businesses, so only the labels change and the picker does not pop in and out.
  const businessOptions = (
    unscopedMemberships.length > 0 ? unscopedMemberships : contextMemberships
  ).map(m => ({
    value: m.businessId,
    label: m.businessName ?? 'Unknown',
    description: m.businessId,
  }));

  // Toggling a business only edits `selectedBusinessIds`. Applying the scope swaps the urql
  // client, which refetches every query — including the one `OnboardingGuard` holds the whole app
  // shell back on, so this menu unmounts with it. Applied on each toggle, that closed the menu
  // after every click; instead the scope is applied once, when the picker or the menu closes.
  function applyBusinessScopeOnClose(open: boolean): void {
    if (!open && !sameBusinessIds(selectedBusinessIds, getBusinessScopeIds())) {
      setBusinessScope(selectedBusinessIds);
    }
  }

  return (
    <>
      {/* Closing the menu can unmount an open picker before it reports its own close. */}
      <DropdownMenu onOpenChange={applyBusinessScopeOnClose}>
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
                  onValueChange={setSelectedBusinessIds}
                  onOpenChange={applyBusinessScopeOnClose}
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
          <DropdownMenuItem asChild>
            <Button variant="ghost" onClick={() => setBalanceChargeModalOpen(true)}>
              Add Balance Charge
            </Button>
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
          {canRunManualAutomations(userContext?.context) && (
            <Tooltip content="Run data fix-ups on demand: flag fees, merge charges, fill debit dates, pull Deel documents">
              <DropdownMenuItem asChild>
                <Link to={ROUTES.CHARGES.MANUAL_AUTOMATIONS}>
                  <CircleCheckBig className="size-4" />
                  <span className="hidden sm:inline">Manual Automations</span>
                </Link>
              </DropdownMenuItem>
            </Tooltip>
          )}
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
