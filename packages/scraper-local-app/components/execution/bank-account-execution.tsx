'use client';

import { useState } from 'react';
import { Banknote, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BankAccountExecution, Transaction } from '@/lib/execution-types';
import { cn } from '@/lib/utils';
import { StepStatusIcon } from './step-status';
import { TransactionFlow } from './transaction-flow';

interface BankAccountExecutionViewProps {
  execution: BankAccountExecution;
}

export function BankAccountExecutionView({ execution }: BankAccountExecutionViewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  const getOverallStatus = () => {
    const flows = [execution.local, execution.foreign, execution.swift];
    const hasError = flows.some(
      f =>
        f.fetch.status === 'error' || f.normalize.status === 'error' || f.insert.status === 'error',
    );
    const allComplete = flows.every(f => f.insert.status === 'success');
    const anyRunning = flows.some(
      f =>
        f.fetch.status === 'running' ||
        f.normalize.status === 'running' ||
        f.insert.status === 'running',
    );

    if (hasError) return 'error';
    if (allComplete) return 'success';
    if (anyRunning) return 'running';
    return 'idle';
  };

  const newTransactionsCount = execution.insertedTransactions.filter(t => t.isNew).length;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-3 w-full p-3 hover:bg-secondary/50 transition-colors">
          <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
          <Banknote className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 text-left">
            <span className="text-sm font-medium">{execution.accountName}</span>
            <span className="text-xs text-muted-foreground ml-2">({execution.accountNumber})</span>
          </div>
          <StepStatusIcon status={getOverallStatus()} />
          {newTransactionsCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {newTransactionsCount} new
            </Badge>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 pt-0 space-y-2">
            <TransactionFlow label="Local Transactions" flow={execution.local} />
            <TransactionFlow label="Foreign Transactions" flow={execution.foreign} />
            <TransactionFlow label="SWIFT Transactions" flow={execution.swift} />

            {execution.insertedTransactions.length > 0 && (
              <Collapsible open={showTransactions} onOpenChange={setShowTransactions}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded hover:bg-secondary/50 transition-colors mt-2">
                  <ChevronRight
                    className={cn('h-4 w-4 transition-transform', showTransactions && 'rotate-90')}
                  />
                  <span className="text-sm font-medium">
                    Inserted Transactions ({execution.insertedTransactions.length})
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <TransactionsTable transactions={execution.insertedTransactions} />
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface TransactionsTableProps {
  transactions: Transaction[];
}

function TransactionsTable({ transactions }: TransactionsTableProps) {
  return (
    <div className="mt-2 border border-border rounded overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Temp ID</TableHead>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs text-right">Amount</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map(tx => (
            <TableRow key={tx.tempId}>
              <TableCell className="text-xs font-mono">{tx.tempId.slice(0, 8)}...</TableCell>
              <TableCell className="text-xs">{tx.date}</TableCell>
              <TableCell className="text-xs max-w-[200px] truncate">{tx.description}</TableCell>
              <TableCell className="text-xs">
                <Badge variant="outline" className="text-xs capitalize">
                  {tx.type}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {tx.amount.toLocaleString()} {tx.currency}
              </TableCell>
              <TableCell className="text-xs">
                {tx.isNew ? (
                  <Badge className="text-xs bg-green-500/20 text-green-500">New</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Existing
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
