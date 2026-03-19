import { type JSX } from 'react';
import { CheckCircle2, Circle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSetupCompletion } from '../../hooks/use-setup-completion.js';
import { ROUTES } from '../../router/routes.js';
import { Progress } from '../ui/progress.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip.js';

export function SetupIndicator(): JSX.Element | null {
  const status = useSetupCompletion();

  if (status.isLoading || status.percentage === 100) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={ROUTES.SETTINGS}
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <Settings size={14} className="text-slate-500" />
            <Progress value={status.percentage} className="w-16 h-1.5" />
            <span className="text-xs text-slate-500">
              {status.completedSteps}/{status.totalSteps}
            </span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2 py-1">
            <p className="text-xs font-medium">Workspace setup</p>
            <div className="space-y-1">
              <SetupItem done={status.hasCompanyName} label="Company name" />
              <SetupItem done={status.hasLogo} label="Company logo" />
              <SetupItem done={status.hasSourceConnected} label="Source connected" />
              <SetupItem done={status.hasActiveSyncedSource} label="First sync complete" />
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SetupItem({ done, label }: { done: boolean; label: string }): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {done ? (
        <CheckCircle2 size={12} className="text-emerald-500" />
      ) : (
        <Circle size={12} className="text-slate-300" />
      )}
      <span className={done ? 'text-slate-600' : 'text-slate-400'}>{label}</span>
    </div>
  );
}
