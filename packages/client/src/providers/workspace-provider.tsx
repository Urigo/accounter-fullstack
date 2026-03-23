import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery } from 'urql';
import { useAuth0 } from '@auth0/auth0-react';

export interface WorkspaceInfo {
  id: string;
  ownerId: string;
  companyName: string | null;
  companyRegistrationNumber: string | null;
  logoUrl: string | null;
  defaultCurrency: string | null;
  agingThresholdDays: number | null;
  matchingToleranceAmount: number | null;
  billingCurrency: string | null;
  billingPaymentTermsDays: number | null;
}

interface WorkspaceContextValue {
  workspace: WorkspaceInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const FALLBACK_COMPANY_NAME = 'Accounter';

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: null,
  isLoading: false,
  error: null,
  refetch: () => {},
});

export function useWorkspace(): WorkspaceContextValue {
  return useContext(WorkspaceContext);
}

export function useWorkspaceDisplayName(): string {
  const { workspace } = useWorkspace();
  return workspace?.companyName || FALLBACK_COMPANY_NAME;
}

export function useWorkspaceLogo(): string | null {
  const { workspace } = useWorkspace();
  return workspace?.logoUrl || null;
}

const WORKSPACE_QUERY = `query WorkspaceSettings {
  workspaceSettings {
    id ownerId companyName companyRegistrationNumber logoUrl
    defaultCurrency agingThresholdDays matchingToleranceAmount
    billingCurrency billingPaymentTermsDays
  }
}`;

export function WorkspaceProvider({ children }: { children?: ReactNode }): ReactNode {
  const { isAuthenticated } = useAuth0();
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [{ data, fetching, error: queryError }, reexecute] = useQuery({
    query: WORKSPACE_QUERY,
    pause: !isAuthenticated,
  });

  useEffect(() => {
    if (queryError) {
      setError(queryError.message);
      setWorkspace(null);
    } else if (data?.workspaceSettings) {
      setWorkspace(data.workspaceSettings as WorkspaceInfo);
      setError(null);
    } else if (data && !data.workspaceSettings) {
      setWorkspace(null);
      setError(null);
    }
  }, [data, queryError]);

  const refetch = () => reexecute({ requestPolicy: 'network-only' });

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        isLoading: fetching,
        error,
        refetch,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
