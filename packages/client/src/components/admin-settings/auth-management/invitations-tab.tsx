import { useCallback, useState, type ReactElement } from 'react';
import { Loader2, Trash2, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';
import { ListInvitationsDocument, type ListInvitationsQuery } from '@/gql/graphql.js';
import { useCreateInvitation } from '@/hooks/use-create-invitation.js';
import { useRevokeInvitation } from '@/hooks/use-revoke-invitation.js';
import { ConfirmationModal } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ListInvitations {
    listInvitations {
      id
      email
      roleId
      expiresAt
    }
  }
`;

// Friendly labels for any role that may appear on an invitation.
const ROLE_LABELS: Record<string, string> = {
  business_owner: 'Business Owner',
  accountant: 'Accountant',
  employee: 'Employee',
  scraper: 'Scraper',
  gmail_listener: 'Gmail Listener',
};

// Roles that make sense to assign to an invited human user.
const INVITABLE_ROLES = [
  { value: 'business_owner', label: ROLE_LABELS.business_owner },
  { value: 'accountant', label: ROLE_LABELS.accountant },
  { value: 'employee', label: ROLE_LABELS.employee },
] as const;

const roleLabel = (roleId: string): string => ROLE_LABELS[roleId] ?? roleId;

const formSchema = z.object({
  email: z.email('Please enter a valid email address'),
  roleId: z.enum(['business_owner', 'accountant', 'employee']),
});

type FormValues = z.infer<typeof formSchema>;

type InvitationRow = ListInvitationsQuery['listInvitations'][number];

export function InvitationsTab(): ReactElement {
  const [{ data, fetching, error }, reexecuteQuery] = useQuery({
    query: ListInvitationsDocument,
  });
  const { revokeInvitation, fetching: revoking } = useRevokeInvitation();

  const refetch = useCallback(
    () => reexecuteQuery({ requestPolicy: 'network-only' }),
    [reexecuteQuery],
  );

  const handleRevoke = useCallback(
    async (id: string) => {
      const result = await revokeInvitation(id);
      // Refetch on success and on a `false` result alike: a `false` means the
      // invitation is no longer pending server-side (already revoked / not
      // found), so the stale row should be dropped. `undefined` is a thrown
      // error, where we leave the list untouched.
      if (result !== undefined) {
        refetch();
      }
    },
    [revokeInvitation, refetch],
  );

  const invitations = data?.listInvitations ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Invitations</h2>
          <p className="text-sm text-muted-foreground">
            Pending invitations to join this business.
          </p>
        </div>
        <InviteUserDialog onInvited={refetch} />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load invitations</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : fetching ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : invitations.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No pending invitations.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation: InvitationRow) => (
              <TableRow key={invitation.id}>
                <TableCell className="font-medium">{invitation.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{roleLabel(invitation.roleId)}</Badge>
                </TableCell>
                <TableCell>{new Date(invitation.expiresAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <ConfirmationModal
                    onConfirm={() => handleRevoke(invitation.id)}
                    title={`Revoke the invitation for "${invitation.email}"? They will no longer be able to accept it.`}
                  >
                    <Button variant="destructive" size="sm" disabled={revoking}>
                      <Trash2 className="size-4" />
                      Revoke
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

function InviteUserDialog({ onInvited }: { onInvited: () => void }): ReactElement {
  const [open, setOpen] = useState(false);
  const { createInvitation, fetching } = useCreateInvitation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', roleId: 'employee' },
  });

  const onSubmit = useCallback(
    async (values: FormValues) => {
      const result = await createInvitation(values);
      if (result) {
        onInvited();
        setOpen(false);
        form.reset();
      }
    },
    [createInvitation, onInvited, form],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        form.reset();
      }
    },
    [form],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation to join this business with the selected role.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="user@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INVITABLE_ROLES.map(role => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={fetching}>
                {fetching && <Loader2 className="size-4 animate-spin" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
