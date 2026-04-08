'use client';

import { Building2, CreditCard, Plus, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AccountConfig, Source } from '@/lib/types';

interface ConfiguredSourceCardProps {
  source: Source;
  accounts: AccountConfig[];
  onConfigure: () => void;
  onAddAccount: () => void;
}

export function ConfiguredSourceCard({
  source,
  accounts,
  onConfigure,
  onAddAccount,
}: ConfiguredSourceCardProps) {
  const accountCount = accounts.length;

  return (
    <Card className="group hover:border-primary/50 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
              {source.type === 'bank' ? (
                <Building2 className="h-6 w-6 text-primary" />
              ) : (
                <CreditCard className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{source.name}</h3>
              <p className="text-sm text-muted-foreground">
                {source.type === 'bank' ? 'Bank Account' : 'Credit Card'}
              </p>
            </div>
          </div>
          <Badge variant="default" className="ml-2">
            {accountCount} {accountCount === 1 ? 'account' : 'accounts'}
          </Badge>
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onConfigure}>
            <Settings className="mr-2 h-4 w-4" />
            Manage
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onAddAccount}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
