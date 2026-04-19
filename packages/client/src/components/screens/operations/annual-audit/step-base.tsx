'use client';

import { useMemo, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Clock, Loader2 } from 'lucide-react';
import type { AnnualAuditStepsStatusQuery } from '@/gql/graphql.js';
import { Badge } from '../../../ui/badge.js';
import { Button } from '../../../ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../ui/card.js';

export type StepStatus = 'completed' | 'in-progress' | 'pending' | 'blocked' | 'loading';

export interface BaseStepProps {
  id: string;
  ref?: React.RefObject<HTMLDivElement | null>;
  title: string;
  description?: string;
  icon?: ReactNode;
  level?: number;
  onStatusChange?: (stepId: string, status: StepStatus) => void;
  manualData: AnnualAuditStepsStatusQuery['annualAuditStepStatuses'] | undefined;
}

export interface StepAction {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const getStatusIcon = (status: StepStatus) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case 'in-progress':
      return <Clock className="h-5 w-5 text-blue-600" />;
    case 'pending':
      return <Clock className="h-5 w-5 text-gray-400" />;
    case 'blocked':
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    case 'loading':
      return <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />;
  }
};

export const getStatusBadge = (status: StepStatus) => {
  const variants = {
    completed: 'default',
    'in-progress': 'secondary',
    pending: 'outline',
    blocked: 'destructive',
    loading: 'outline',
  } as const;

  const labels = {
    completed: 'Completed',
    'in-progress': 'In Progress',
    pending: 'Pending',
    blocked: 'Blocked',
    loading: 'Loading...',
  };

  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
};

export const SubstepWrapper = ({
  children,
  ref,
  level,
}: {
  children: ReactNode;
  level: number;
  ref?: React.RefObject<HTMLDivElement | null>;
}) => {
  return (
    <div
      ref={ref}
      className={`${level > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''} relative`}
    >
      {children}
    </div>
  );
};

interface BaseStepCardProps extends BaseStepProps {
  status: StepStatus;
  statusIndicator?: ReactNode;
  actions?: StepAction[];
  children?: ReactNode;
  footer?: ReactNode;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  disabled?: boolean;
}

export function BaseStepCard({
  id,
  ref,
  title,
  description,
  icon,
  status,
  statusIndicator,
  actions,
  children,
  footer,
  isExpanded,
  onToggleExpanded,
  level = 0,
  disabled = false,
  manualData,
}: BaseStepCardProps) {
  const persistedStepRecord = useMemo(() => {
    if (!Array.isArray(manualData)) return undefined;
    return manualData.find(record => record.stepId === id);
  }, [manualData, id]);

  const persistedManualNotes = persistedStepRecord?.notes ?? null;
  return (
    <SubstepWrapper ref={ref} level={level}>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isExpanded == null ? (
                <div className="w-4" />
              ) : (
                <Button
                  disabled={disabled}
                  variant="ghost"
                  size="sm"
                  onClick={onToggleExpanded}
                  className="p-0 h-auto"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
              {getStatusIcon(status)}
              {icon}
              <div>
                <CardTitle className="text-lg">
                  {id}. {title}
                </CardTitle>
                {description && <CardDescription className="mt-1">{description}</CardDescription>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {statusIndicator}
              {getStatusBadge(status)}
            </div>
          </div>
        </CardHeader>
        {actions && actions.length > 0 && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {actions.map((action, index) => {
                return (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    disabled={action.disabled || disabled}
                    onClick={action.onClick}
                    asChild={!!action.href && !disabled && !action.disabled}
                  >
                    {action.href ? <a href={action.href}>{action.label}</a> : action.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        )}
        {(footer || persistedManualNotes) && (
          <CardFooter className="flex flex-col gap-2 items-start">
            {footer}
            {persistedManualNotes && (
              <div className="mt-2 text-sm text-muted-foreground">
                Notes: {persistedManualNotes}
              </div>
            )}
          </CardFooter>
        )}
        {children}
      </Card>

      {/* disabled overlay */}
      {disabled && (
        <Card
          className={`absolute inset-0 bg-gray-500 opacity-50 pointer-events-auto z-10 ${level > 0 ? 'ml-4' : ''}`}
        />
      )}
    </SubstepWrapper>
  );
}
