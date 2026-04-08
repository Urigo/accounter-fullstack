'use client';

import {
  ArrowLeft,
  Briefcase,
  Building2,
  CreditCard,
  Pencil,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountConfig, BankAccountConfig, isBankAccount, Source } from '@/lib/types';

interface AccountsListProps {
  source: Source;
  accounts: AccountConfig[];
  onEdit: (account: AccountConfig) => void;
  onDelete: (accountId: string) => void;
  onAdd: () => void;
  onBack: () => void;
}

export function AccountsList({
  source,
  accounts,
  onEdit,
  onDelete,
  onAdd,
  onBack,
}: AccountsListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              {source.type === 'bank' ? (
                <Building2 className="h-5 w-5 text-primary" />
              ) : (
                <CreditCard className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <CardTitle>{source.name}</CardTitle>
              <CardDescription>
                {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} configured
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No accounts configured yet.</p>
            <Button variant="link" onClick={onAdd} className="mt-2">
              Add your first account
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map(account => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background">
                    {isBankAccount(account) && (account as BankAccountConfig).isBusinessAccount ? (
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {account.nickname || account.username || 'Unnamed Account'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground">{account.username}</p>
                      {isBankAccount(account) &&
                        (account as BankAccountConfig).isBusinessAccount && (
                          <Badge variant="outline" className="text-xs">
                            Business
                          </Badge>
                        )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(account)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(account.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button onClick={onAdd} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Another Account
        </Button>
      </CardContent>
    </Card>
  );
}
