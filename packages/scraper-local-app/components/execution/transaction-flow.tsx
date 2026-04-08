'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TransactionFlowStep } from '@/lib/execution-types';
import { cn } from '@/lib/utils';
import { StepStatusIcon } from './step-status';

interface TransactionFlowProps {
  label: string;
  flow: TransactionFlowStep;
}

export function TransactionFlow({ label, flow }: TransactionFlowProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasError =
    flow.fetch.status === 'error' ||
    flow.normalize.status === 'error' ||
    flow.insert.status === 'error';

  const isComplete = flow.insert.status === 'success';
  const isRunning =
    flow.fetch.status === 'running' ||
    flow.normalize.status === 'running' ||
    flow.insert.status === 'running';

  const getOverallStatus = () => {
    if (hasError) return 'error';
    if (isComplete) return 'success';
    if (isRunning) return 'running';
    return 'idle';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded hover:bg-secondary/50 transition-colors">
        <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
        <StepStatusIcon status={getOverallStatus()} />
        <span className="text-sm font-medium">{label}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 pl-4 border-l border-border space-y-1 py-2">
          <StepItem label="Fetch" result={flow.fetch} />
          <StepItem label="Normalize" result={flow.normalize} />
          <StepItem label="Insert to server" result={flow.insert} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface StepItemProps {
  label: string;
  result: { status: string; message?: string; error?: string };
}

function StepItem({ label, result }: StepItemProps) {
  return (
    <div className="flex items-center gap-2 py-1">
      <StepStatusIcon status={result.status as any} className="h-3 w-3" />
      <span className="text-xs text-muted-foreground">{label}</span>
      {result.message && (
        <span className="text-xs text-muted-foreground/70">- {result.message}</span>
      )}
      {result.error && <span className="text-xs text-destructive">- {result.error}</span>}
    </div>
  );
}
