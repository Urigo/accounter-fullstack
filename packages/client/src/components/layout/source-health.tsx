import { type JSX } from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from 'urql';
import { ROUTES } from '../../router/routes.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip.js';

const SOURCE_HEALTH_QUERY = `
  query SourceHealth {
    sourceConnections {
      id displayName status lastSyncAt lastSyncError
    }
  }
`;

interface SourceInfo {
  id: string;
  displayName: string;
  status: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

export function SourceHealthBadge(): JSX.Element | null {
  const [{ data, fetching }] = useQuery({ query: SOURCE_HEALTH_QUERY });

  if (fetching) {
    return <Loader2 size={14} className="animate-spin text-slate-400" />;
  }

  const sources: SourceInfo[] = data?.sourceConnections ?? [];
  if (sources.length === 0) return null;

  const hasError = sources.some(s => s.status === 'ERROR');
  const allActive = sources.every(s => s.status === 'ACTIVE');
  const latestSync = sources
    .map(s => s.lastSyncAt)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={`${ROUTES.SETTINGS}?tab=sources`}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            {hasError ? (
              <AlertCircle size={14} className="text-red-500" />
            ) : allActive ? (
              <CheckCircle2 size={14} className="text-emerald-500" />
            ) : (
              <Clock size={14} className="text-amber-500" />
            )}
            {latestSync && (
              <span className="text-xs text-slate-500">
                {formatRelativeTime(latestSync)}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1.5 py-1">
            <p className="text-xs font-medium">Source health</p>
            {sources.map(source => (
              <div key={source.id} className="flex items-center gap-1.5 text-xs">
                {source.status === 'ACTIVE' ? (
                  <CheckCircle2 size={12} className="text-emerald-500" />
                ) : source.status === 'ERROR' ? (
                  <AlertCircle size={12} className="text-red-500" />
                ) : (
                  <Clock size={12} className="text-amber-500" />
                )}
                <span className="text-slate-600">{source.displayName}</span>
                <span className="text-slate-400 ml-auto">
                  {formatRelativeTime(source.lastSyncAt)}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
