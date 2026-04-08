'use client';

import { useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { IsracardExecution, Transaction } from '@/lib/execution-types';
import { StepStatusBadge } from './step-status';

interface IsracardExecutionViewProps {
  execution: IsracardExecution;
}

function MonthFlowView({
  month,
  flow,
  transactions,
}: {
  month: string;
  flow: {
    fetch: { status: string; message?: string; error?: string };
    normalize: { status: string; message?: string; error?: string };
    insert: { status: string; message?: string; error?: string };
  };
  transactions: Transaction[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const newTxCount = transactions.filter(t => t.isNew).length;

  const hasError =
    flow.fetch.status === 'error' ||
    flow.normalize.status === 'error' ||
    flow.insert.status === 'error';
  const isComplete = flow.insert.status === 'success';

  const formatMonth = (monthStr: string) => {
    const [year, m] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
          <div className="flex items-center gap-3">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatMonth(month)}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasError && <Badge variant="destructive">Error</Badge>}
            {isComplete && newTxCount > 0 && <Badge variant="default">{newTxCount} new</Badge>}
            {isComplete && newTxCount === 0 && <Badge variant="secondary">No new</Badge>}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-8 pt-2 space-y-2">
          {/* Steps */}
          <div className="flex flex-wrap gap-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Fetch:</span>
              <StepStatusBadge
                status={
                  flow.fetch.status as 'idle' | 'running' | 'success' | 'error' | 'waiting-input'
                }
              />
              {flow.fetch.error && (
                <span className="text-xs text-destructive">{flow.fetch.error}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Normalize:</span>
              <StepStatusBadge
                status={
                  flow.normalize.status as
                    | 'idle'
                    | 'running'
                    | 'success'
                    | 'error'
                    | 'waiting-input'
                }
              />
              {flow.normalize.error && (
                <span className="text-xs text-destructive">{flow.normalize.error}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Insert:</span>
              <StepStatusBadge
                status={
                  flow.insert.status as 'idle' | 'running' | 'success' | 'error' | 'waiting-input'
                }
              />
              {flow.insert.error && (
                <span className="text-xs text-destructive">{flow.insert.error}</span>
              )}
            </div>
          </div>

          {/* Transactions Table */}
          {transactions.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Temp ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(tx => (
                    <TableRow key={tx.tempId}>
                      <TableCell className="font-mono text-xs">{tx.tempId.slice(0, 8)}</TableCell>
                      <TableCell>{tx.date}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={tx.amount < 0 ? 'text-destructive' : 'text-primary'}>
                          {tx.amount.toLocaleString()} {tx.currency}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tx.isNew ? (
                          <Badge variant="default" className="text-xs">
                            New
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Exists
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function IsracardExecutionView({ execution }: IsracardExecutionViewProps) {
  const [isOpen, setIsOpen] = useState(true);

  const totalNewTransactions = execution.months.reduce(
    (sum, m) => sum + m.insertedTransactions.filter(t => t.isNew).length,
    0,
  );

  const hasErrors =
    execution.login.status === 'error' ||
    execution.months.some(
      m =>
        m.flow.fetch.status === 'error' ||
        m.flow.normalize.status === 'error' ||
        m.flow.insert.status === 'error',
    );

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {execution.nickname || 'Isracard Account'}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{execution.monthsToScrape} months</Badge>
                {hasErrors && <Badge variant="destructive">Has Errors</Badge>}
                {totalNewTransactions > 0 && (
                  <Badge variant="default">{totalNewTransactions} new total</Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Step 1: Login */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <span className="font-medium text-sm w-24">1. Login</span>
              <StepStatusBadge status={execution.login.status} />
              {execution.login.message && (
                <span className="text-sm text-muted-foreground">{execution.login.message}</span>
              )}
              {execution.login.error && (
                <span className="text-sm text-destructive">{execution.login.error}</span>
              )}
            </div>

            {/* Step 2: Per-Month Execution */}
            {execution.months.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">2. Monthly Processing</h4>
                <div className="space-y-2">
                  {execution.months.map(monthExec => (
                    <MonthFlowView
                      key={monthExec.month}
                      month={monthExec.month}
                      flow={monthExec.flow}
                      transactions={monthExec.insertedTransactions}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
