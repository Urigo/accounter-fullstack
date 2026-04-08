'use client';

import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { StepStatus } from '@/lib/execution-types';
import { cn } from '@/lib/utils';

interface StepStatusIconProps {
  status: StepStatus;
  className?: string;
}

export function StepStatusIcon({ status, className }: StepStatusIconProps) {
  switch (status) {
    case 'running':
      return <Loader2 className={cn('h-4 w-4 animate-spin text-primary', className)} />;
    case 'success':
      return <CheckCircle2 className={cn('h-4 w-4 text-green-500', className)} />;
    case 'error':
      return <XCircle className={cn('h-4 w-4 text-destructive', className)} />;
    case 'waiting-input':
      return <AlertTriangle className={cn('h-4 w-4 text-yellow-500', className)} />;
    default:
      return <Clock className={cn('h-4 w-4 text-muted-foreground/50', className)} />;
  }
}

interface StepStatusBadgeProps {
  status: StepStatus;
  label?: string;
}

export function StepStatusBadge({ status, label }: StepStatusBadgeProps) {
  const statusColors: Record<StepStatus, string> = {
    idle: 'bg-muted text-muted-foreground',
    running: 'bg-primary/20 text-primary',
    success: 'bg-green-500/20 text-green-500',
    error: 'bg-destructive/20 text-destructive',
    'waiting-input': 'bg-yellow-500/20 text-yellow-500',
  };

  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusColors[status])}>
      {label}
    </span>
  );
}
