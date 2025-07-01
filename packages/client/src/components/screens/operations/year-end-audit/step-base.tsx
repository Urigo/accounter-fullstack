'use client';

import { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { Badge } from '../../../ui/badge.js';
import { Button } from '../../../ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card.js';

export type StepStatus = 'completed' | 'in-progress' | 'pending' | 'blocked' | 'loading';

export interface BaseStepProps {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  level?: number;
  onStatusChange?: (stepId: string, status: StepStatus) => void;
}

export interface StepAction {
  label: string;
  href?: string;
  onClick?: () => void;
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

interface BaseStepCardProps extends BaseStepProps {
  status: StepStatus;
  actions?: StepAction[];
  children?: ReactNode;
  hasSubsteps?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export function BaseStepCard({
  id,
  title,
  description,
  icon,
  status,
  actions,
  children,
  hasSubsteps = false,
  isExpanded = false,
  onToggleExpanded,
  onStatusChange,
  level = 0,
}: BaseStepCardProps) {
  return (
    <div className={`${level > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}`}>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasSubsteps ? (
                <Button variant="ghost" size="sm" onClick={onToggleExpanded} className="p-0 h-auto">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              ) : (
                <div className="w-4" />
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
            {getStatusBadge(status)}
          </div>
        </CardHeader>
        {actions && actions.length > 0 && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={action.onClick}
                  asChild={!!action.href}
                >
                  {action.href ? <a href={action.href}>{action.label}</a> : action.label}
                </Button>
              ))}
            </div>
          </CardContent>
        )}
        {children}
      </Card>
    </div>
  );
}
