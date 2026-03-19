import { useCallback, useState, type JSX } from 'react';
import { Check, Clock, Copy, Mail, MoreHorizontal, Plus, Trash2, UserMinus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery } from 'urql';
import { Badge } from '../../../ui/badge.js';
import { Button } from '../../../ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu.js';
import { Input } from '../../../ui/input.js';
import { Label } from '../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import { Separator } from '../../../ui/separator.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- codegen
/* GraphQL */ `
  query ListTeamMembers {
    listTeamMembers {
      id
      userId
      email
      roleId
      roleLabel
      createdAt
      updatedAt
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- codegen
/* GraphQL */ `
  query ListPendingInvitations {
    listPendingInvitations {
      id
      email
      roleId
      roleLabel
      expiresAt
      createdAt
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- codegen
/* GraphQL */ `
  mutation CreateInvitation($email: String!, $roleId: String!) {
    createInvitation(email: $email, roleId: $roleId) {
      id
      email
      roleId
      expiresAt
      token
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- codegen
/* GraphQL */ `
  mutation RevokeInvitation($invitationId: ID!) {
    revokeInvitation(invitationId: $invitationId)
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- codegen
/* GraphQL */ `
  mutation RemoveTeamMember($userId: ID!) {
    removeTeamMember(userId: $userId)
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- codegen
/* GraphQL */ `
  mutation UpdateTeamMemberRole($userId: ID!, $roleId: String!) {
    updateTeamMemberRole(userId: $userId, roleId: $roleId) {
      id
      userId
      email
      roleId
      roleLabel
      createdAt
      updatedAt
    }
  }
`;

import {
  CreateInvitationDocument,
  ListPendingInvitationsDocument,
  ListTeamMembersDocument,
  RemoveTeamMemberDocument,
  RevokeInvitationDocument,
  UpdateTeamMemberRoleDocument,
} from '../../../../gql/graphql.js';

const ROLE_OPTIONS = [
  { id: 'business_owner', label: 'Admin', description: 'Full access including team management' },
  {
    id: 'accountant',
    label: 'Member',
    description: 'Can view and edit financial data',
  },
  { id: 'viewer', label: 'Observer', description: 'Read-only access, cannot make changes' },
];

function roleBadgeVariant(roleId: string): 'default' | 'secondary' | 'outline' {
  if (roleId === 'business_owner') return 'default';
  if (roleId === 'viewer') return 'outline';
  return 'secondary';
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function InviteForm({ onDone }: { onDone: () => void }): JSX.Element {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('accountant');
  const [, createInvitation] = useMutation(CreateInvitationDocument);
  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    const result = await createInvitation({ email: email.trim().toLowerCase(), roleId });
    if (result.error) {
      toast.error(result.error.graphQLErrors?.[0]?.message ?? 'Failed to create invitation');
      return;
    }
    const token = result.data?.createInvitation.token;
    if (token) {
      const link = `${window.location.origin}/accept-invitation/${token}`;
      setPendingLink(link);
    }
    toast.success(`Invitation created for ${email}`);
    setEmail('');
  }, [email, roleId, createInvitation]);

  const handleCopy = useCallback(() => {
    if (!pendingLink) return;
    navigator.clipboard.writeText(pendingLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [pendingLink]);

  if (pendingLink) {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-green-50 border border-green-200 p-4 space-y-2">
          <p className="text-sm font-medium text-green-800">Invitation created</p>
          <p className="text-xs text-green-700">
            Send this link to the invitee. It expires in 7 days.
          </p>
          <div className="flex gap-2 mt-2">
            <Input
              value={pendingLink}
              readOnly
              className="text-xs font-mono bg-white"
            />
            <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 gap-1">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setPendingLink(null); }}>
            Invite another
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <div className="space-y-1">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSubmit(); }}
          />
        </div>
        <div className="space-y-1">
          <Label>Role</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>
                  <div>
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void handleSubmit()} size="sm" className="gap-1">
            <Mail size={14} />
            Send invite
          </Button>
          <Button variant="ghost" size="sm" onClick={onDone}>
            <X size={14} />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        An invitation link will be generated. Email delivery is not yet configured - copy and share the link manually.
      </p>
    </div>
  );
}

export function TeamTab(): JSX.Element {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [{ data: membersData, fetching: membersFetching }, refetchMembers] = useQuery({
    query: ListTeamMembersDocument,
  });
  const [{ data: invitationsData, fetching: invitationsFetching }, refetchInvitations] = useQuery({
    query: ListPendingInvitationsDocument,
  });

  const [, removeTeamMember] = useMutation(RemoveTeamMemberDocument);
  const [, revokeInvitation] = useMutation(RevokeInvitationDocument);
  const [, updateRole] = useMutation(UpdateTeamMemberRoleDocument);

  const handleRemoveMember = useCallback(
    async (userId: string, email: string | null | undefined) => {
      if (!confirm(`Remove ${email ?? 'this member'} from the workspace?`)) return;
      const result = await removeTeamMember({ userId });
      if (result.error) {
        toast.error('Failed to remove member');
        return;
      }
      toast.success('Member removed');
      refetchMembers({ requestPolicy: 'network-only' });
    },
    [removeTeamMember, refetchMembers],
  );

  const handleRevokeInvitation = useCallback(
    async (invitationId: string, email: string) => {
      const result = await revokeInvitation({ invitationId });
      if (result.error) {
        toast.error('Failed to revoke invitation');
        return;
      }
      toast.success(`Invitation for ${email} revoked`);
      refetchInvitations({ requestPolicy: 'network-only' });
    },
    [revokeInvitation, refetchInvitations],
  );

  const handleUpdateRole = useCallback(
    async (userId: string, newRoleId: string) => {
      const result = await updateRole({ userId, roleId: newRoleId });
      if (result.error) {
        toast.error('Failed to update role');
        return;
      }
      toast.success('Role updated');
      refetchMembers({ requestPolicy: 'network-only' });
    },
    [updateRole, refetchMembers],
  );

  const members = membersData?.listTeamMembers ?? [];
  const pendingInvitations = invitationsData?.listPendingInvitations ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Team members</CardTitle>
              <CardDescription>
                Manage who has access to this workspace and what they can do.
              </CardDescription>
            </div>
            {!showInviteForm && (
              <Button size="sm" className="gap-1" onClick={() => setShowInviteForm(true)}>
                <Plus size={14} />
                Invite
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showInviteForm && (
            <>
              <InviteForm
                onDone={() => {
                  setShowInviteForm(false);
                  refetchMembers({ requestPolicy: 'network-only' });
                  refetchInvitations({ requestPolicy: 'network-only' });
                }}
              />
              <Separator />
            </>
          )}

          {membersFetching ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No team members found.
            </div>
          ) : (
            <div className="divide-y">
              {members.map(member => (
                <div key={member.userId} className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                      {member.email ?? <span className="text-muted-foreground italic">Unknown</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined {formatDate(member.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={roleBadgeVariant(member.roleId)}>{member.roleLabel}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ROLE_OPTIONS.filter(r => r.id !== member.roleId).map(role => (
                          <DropdownMenuItem
                            key={role.id}
                            onClick={() => void handleUpdateRole(member.userId, role.id)}
                          >
                            <Check size={14} className="mr-2 opacity-0" />
                            Make {role.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => void handleRemoveMember(member.userId, member.email)}
                        >
                          <UserMinus size={14} className="mr-2" />
                          Remove from workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(pendingInvitations.length > 0 || invitationsFetching) && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock size={16} />
              Pending invitations
            </CardTitle>
            <CardDescription>
              These invitations have been created but not yet accepted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitationsFetching ? (
              <div className="text-sm text-muted-foreground py-2 text-center">
                Loading...
              </div>
            ) : (
              <div className="divide-y">
                {pendingInvitations.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">{inv.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Expires {formatDate(inv.expiresAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={roleBadgeVariant(inv.roleId)}>{inv.roleLabel}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        title="Revoke invitation"
                        onClick={() => void handleRevokeInvitation(inv.id, inv.email)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Role permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ROLE_OPTIONS.map(role => (
              <div key={role.id} className="flex items-start gap-3">
                <Badge variant={roleBadgeVariant(role.id)} className="mt-0.5 shrink-0">
                  {role.label}
                </Badge>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
