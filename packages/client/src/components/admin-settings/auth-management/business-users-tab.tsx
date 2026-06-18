import { useCallback, type ReactElement } from 'react';
import { Trash2 } from 'lucide-react';
import { useQuery } from 'urql';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Skeleton } from '@/components/ui/skeleton.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';
import { ListBusinessUsersDocument, type ListBusinessUsersQuery } from '@/gql/graphql.js';
import { useRemoveBusinessUser } from '@/hooks/use-remove-business-user.js';
import { ConfirmationModal } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ListBusinessUsers {
    listBusinessUsers {
      id
      email
      name
      roleId
      createdAt
    }
  }
`;

// Friendly labels for any role a business user may hold.
const ROLE_LABELS: Record<string, string> = {
  business_owner: 'Business Owner',
  accountant: 'Accountant',
  employee: 'Employee',
  scraper: 'Scraper',
  gmail_listener: 'Gmail Listener',
};

const roleLabel = (roleId: string): string => ROLE_LABELS[roleId] ?? roleId;

type BusinessUserRow = ListBusinessUsersQuery['listBusinessUsers'][number];

export function BusinessUsersTab(): ReactElement {
  const [{ data, fetching, error }, reexecuteQuery] = useQuery({
    query: ListBusinessUsersDocument,
  });
  const { removeBusinessUser, fetching: removing } = useRemoveBusinessUser();

  const refetch = useCallback(
    () => reexecuteQuery({ requestPolicy: 'network-only' }),
    [reexecuteQuery],
  );

  const handleRemove = useCallback(
    async (userId: string) => {
      const result = await removeBusinessUser(userId);
      // Refetch on success and on a `false` result alike: `false` means the user
      // is no longer a member server-side, so the stale row should be dropped.
      // `undefined` is a thrown error, where we leave the list untouched.
      if (result !== undefined) {
        refetch();
      }
    },
    [removeBusinessUser, refetch],
  );

  const users = data?.listBusinessUsers ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Users</h2>
        <p className="text-sm text-muted-foreground">People with access to this business.</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load users</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : fetching ? (
        <BusinessUsersTableSkeleton />
      ) : users.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user: BusinessUserRow) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.name ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{roleLabel(user.roleId)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <ConfirmationModal
                    onConfirm={() => handleRemove(user.id)}
                    title={`Remove ${user.name ?? user.email} from this business? They will lose access immediately.`}
                  >
                    <Button variant="destructive" size="sm" disabled={removing}>
                      <Trash2 className="size-4" />
                      Remove User
                    </Button>
                  </ConfirmationModal>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function BusinessUsersTableSkeleton(): ReactElement {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 4 }).map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-48" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-6 w-24" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="ml-auto h-8 w-28" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
