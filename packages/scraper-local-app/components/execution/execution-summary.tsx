'use client';

import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExecutionSummary } from '@/lib/execution-types';
import { AVAILABLE_SOURCES } from '@/lib/types';

interface ExecutionSummaryCardProps {
  summary: ExecutionSummary;
}

export function ExecutionSummaryCard({ summary }: ExecutionSummaryCardProps) {
  const hasErrors = summary.totalFailedFlows > 0;
  const hasSuccesses = summary.totalNewTransactions > 0;

  const completedDate = new Date(summary.completedAt);
  const formattedDate = completedDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card className={hasErrors ? 'border-destructive/50' : 'border-primary/50'}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasErrors ? (
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-primary" />
            )}
            <CardTitle className="text-lg">Execution Summary</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formattedDate}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="text-3xl font-bold text-primary">{summary.totalNewTransactions}</div>
            <div className="text-sm text-muted-foreground">New Transactions Inserted</div>
          </div>
          <div
            className={`p-4 rounded-lg ${hasErrors ? 'bg-destructive/10 border border-destructive/20' : 'bg-secondary border border-border'}`}
          >
            <div
              className={`text-3xl font-bold ${hasErrors ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {summary.totalFailedFlows}
            </div>
            <div className="text-sm text-muted-foreground">Failed Flows</div>
          </div>
        </div>

        {/* Per-Account Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">By Account</h4>
          <div className="space-y-2">
            {summary.accounts.map(account => {
              const source = AVAILABLE_SOURCES.find(s => s.id === account.sourceId);

              return (
                <div
                  key={account.accountConfigId}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    {account.hasErrors ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                    <div>
                      <span className="font-medium">{account.nickname}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({source?.name || account.sourceId})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.newTransactionsCount > 0 && (
                      <Badge variant="default">{account.newTransactionsCount} new</Badge>
                    )}
                    {account.failedFlows.length > 0 && (
                      <Badge variant="destructive">{account.failedFlows.length} failed</Badge>
                    )}
                    {account.newTransactionsCount === 0 && account.failedFlows.length === 0 && (
                      <Badge variant="secondary">No new</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Failed Flows Details */}
        {hasErrors && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-destructive">Failed Flows</h4>
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
              {summary.accounts
                .filter(a => a.failedFlows.length > 0)
                .map(account => (
                  <div key={account.accountConfigId} className="text-sm">
                    <span className="font-medium">{account.nickname}:</span>{' '}
                    <span className="text-muted-foreground">{account.failedFlows.join(', ')}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
