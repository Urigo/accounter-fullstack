import { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { Badge } from '../../../ui/badge.jsx';
import { Button } from '../../../ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card.jsx';
import { Collapsible, CollapsibleContent } from '../../../ui/collapsible.js';

type StepStatus = 'completed' | 'in-progress' | 'pending' | 'blocked';

export interface AuditStepInfo {
  id: string;
  title: string;
  description?: string;
  status: StepStatus;
  substeps?: AuditStepInfo[];
  actions?: { label: string; href?: string; onClick?: () => void }[];
  icon?: ReactNode;
  expansion?: ReactNode;
}

const getStatusIcon = (status: StepStatus) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case 'in-progress':
      return <Clock className="h-5 w-5 text-blue-600" />;
    case 'pending':
      return <Clock className="h-5 w-5 text-gray-400" />;
    case 'blocked':
      return <AlertCircle className="h-5 w-5 text-red-600" />;
  }
};

const getStatusBadge = (status: StepStatus) => {
  const variants = {
    completed: 'default',
    'in-progress': 'secondary',
    pending: 'outline',
    blocked: 'destructive',
  } as const;

  const labels = {
    completed: 'Completed',
    'in-progress': 'In Progress',
    pending: 'Pending',
    blocked: 'Blocked',
  };

  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
};

type Props = {
  step: AuditStepInfo;
  level?: number;
  toggleSection: (id: string) => void;
  isExpanded?: boolean;
};

export function AuditStep({ step, level = 0, toggleSection, isExpanded }: Props) {
  const hasSubSteps = step.substeps && step.substeps.length > 0;

  return (
    <div key={step.id} className={`${level > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}`}>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasSubSteps ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection(step.id)}
                  className="p-0 h-auto"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              ) : (
                <div className="w-4" />
              )}
              {getStatusIcon(step.status)}
              {step.icon}
              <div>
                <CardTitle className="text-lg">
                  {step.id}. {step.title}
                </CardTitle>
                {step.description && (
                  <CardDescription className="mt-1">{step.description}</CardDescription>
                )}
              </div>
            </div>
            {getStatusBadge(step.status)}
          </div>
        </CardHeader>
        {step.actions && step.actions.length > 0 && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {step.actions.map((action, index) => (
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
        {step.expansion ?? null}
      </Card>

      {hasSubSteps && (
        <Collapsible open={isExpanded}>
          <CollapsibleContent className="space-y-2">
            {step.substeps!.map(substep => (
              <AuditStep
                step={substep}
                level={level + 1}
                toggleSection={toggleSection}
                isExpanded={false}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
