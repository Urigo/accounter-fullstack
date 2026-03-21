import { useEffect, useRef, useState } from 'react';
import { useQuery } from 'urql';
import { useWorkspace } from '../providers/workspace-provider.js';

const SOURCE_CONNECTIONS_QUERY = `
  query SourceConnectionsForSetup {
    sourceConnections {
      id status lastSyncAt
    }
  }
`;

export interface SetupStatus {
  hasCompanyName: boolean;
  hasLogo: boolean;
  hasSourceConnected: boolean;
  hasActiveSyncedSource: boolean;
  completedSteps: number;
  totalSteps: number;
  percentage: number;
  isFirstRun: boolean;
  isLoading: boolean;
}

export function useSetupCompletion(): SetupStatus {
  const { workspace, isLoading: wsLoading } = useWorkspace();
  const [{ data, fetching }] = useQuery({
    query: SOURCE_CONNECTIONS_QUERY,
  });

  // Track whether both queries have completed at least once.
  // This prevents a false "isFirstRun" on the very first render when
  // fetching=false momentarily before the queries have actually started,
  // which causes the onboarding guard to redirect in incognito/new sessions.
  const wsSettledRef = useRef(false);
  const srcSettledRef = useRef(false);
  const [settled, setSettled] = useState(false);

  if (!wsLoading && workspace !== undefined) wsSettledRef.current = true;
  if (!fetching && data !== undefined) srcSettledRef.current = true;

  useEffect(() => {
    if (wsSettledRef.current && srcSettledRef.current && !settled) {
      setSettled(true);
    }
  });

  const isLoading = !settled || wsLoading || fetching;

  const hasCompanyName = !!workspace?.companyName;
  const hasLogo = !!workspace?.logoUrl;

  const sources = data?.sourceConnections ?? [];
  const hasSourceConnected = sources.length > 0;
  const hasActiveSyncedSource = sources.some(
    (s: { status: string; lastSyncAt: string | null }) =>
      s.status === 'ACTIVE' && s.lastSyncAt,
  );

  const steps = [hasCompanyName, hasLogo, hasSourceConnected, hasActiveSyncedSource];
  const completedSteps = steps.filter(Boolean).length;
  const totalSteps = steps.length;
  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Only declare "first run" once we have settled server data confirming nothing is set up.
  const isFirstRun = !isLoading && !hasCompanyName && !hasSourceConnected;

  return {
    hasCompanyName,
    hasLogo,
    hasSourceConnected,
    hasActiveSyncedSource,
    completedSteps,
    totalSteps,
    percentage,
    isFirstRun,
    isLoading,
  };
}
