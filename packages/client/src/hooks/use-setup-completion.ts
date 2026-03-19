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

  const isLoading = wsLoading || fetching;

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
