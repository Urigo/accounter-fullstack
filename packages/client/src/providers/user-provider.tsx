import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import equal from 'deep-equal';
import { useClient, useQuery, type CombinedError } from 'urql';
import { useAuth0 } from '@auth0/auth0-react';
import { AccounterLoader } from '../components/common/loaders/loader.js';
import { UserContextDocument, type UserContextQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query UserContext {
    # Read in the same request as the user context, for the onboarding guard: one boot request
    # instead of two, the second of which waited for the first.
    viewer {
      email
      emailVerified
      status
    }
    userContext {
      memberships {
        businessId
        role
        businessName
      }
      activeReadScope
      defaultLocalCurrency
      defaultCryptoConversionFiatCurrency
      ledgerLock
      financialAccountsBusinessesIds
      foreignSecuritiesBusinessId
      locality
    }
  }
`;

type ContextType = {
  userContext: UserInfo | null;
  setUserContext: (filtersContext: UserInfo | null) => void;
  /**
   * Re-reads the user context from the server, without the app-wide loader the first read shows,
   * after a change to a setting it is derived from.
   */
  refreshUserContext?: () => Promise<void>;
  /** The boot read: who the caller is and whether they are provisioned. See {@link SessionState}. */
  session?: SessionState;
};

/**
 * The caller's identity and provisioning state (`viewer`), from the request that also reads the
 * user context. `viewer` answers even for an identity linked to no business, whose `userContext`
 * fails with `ONBOARDING_REQUIRED`, so the onboarding guard can still tell why.
 */
export type SessionState = {
  /** The boot request has answered, with data, an error or both. */
  loaded: boolean;
  /**
   * Set only when `viewer` itself could not be read. The `userContext` error of an unprovisioned
   * identity comes in the same response and is not one: `viewer` answered, and says why.
   */
  error: CombinedError | undefined;
  viewer: UserContextQuery['viewer'];
};

function toSessionState(
  data: UserContextQuery | undefined,
  error: CombinedError | undefined,
  fetching: boolean,
): SessionState {
  const viewerFailed =
    !!error &&
    (!!error.networkError ||
      !data ||
      error.graphQLErrors.some(graphQLError => graphQLError.path?.[0] === 'viewer'));
  return {
    loaded: !fetching && (!!data || !!error),
    error: viewerFailed ? error : undefined,
    viewer: data?.viewer ?? null,
  };
}

export interface BusinessMembershipInfo {
  businessId: string;
  role: string;
  businessName?: string | null;
}

export interface UserInfo extends User {
  context: {
    memberships: BusinessMembershipInfo[];
    activeReadScope: string[];
    // Derived client-side from the active read scope while the multi-business
    // client UI is built; kept so existing single-business consumers compile.
    adminBusinessId: string;
    defaultLocalCurrency: string;
    defaultCryptoConversionFiatCurrency: string;
    ledgerLock?: string | null;
    financialAccountsBusinessesIds: string[];
    /** The general foreign-securities business — the fallback counterparty for a trade. */
    foreignSecuritiesBusinessId: string | null;
    locality: string;
  };
}

// Map the (now multi-business) server payload to the client context shape,
// deriving the legacy single-business fields used across the app today.
function toUserInfoContext(
  userContext: NonNullable<UserContextQuery['userContext']>,
): UserInfo['context'] {
  const memberships = userContext.memberships ?? [];
  const activeReadScope = userContext.activeReadScope ?? [];
  const adminBusinessId = activeReadScope[0] ?? memberships[0]?.businessId ?? '';
  return {
    memberships,
    activeReadScope,
    adminBusinessId,
    defaultLocalCurrency: userContext.defaultLocalCurrency ?? '',
    defaultCryptoConversionFiatCurrency: userContext.defaultCryptoConversionFiatCurrency ?? '',
    ledgerLock: userContext.ledgerLock,
    financialAccountsBusinessesIds: userContext.financialAccountsBusinessesIds ?? [],
    foreignSecuritiesBusinessId: userContext.foreignSecuritiesBusinessId ?? null,
    locality: userContext.locality ?? '',
  };
}

type User = {
  username: string;
};

/**
 * Runs the user context query again through the client rather than by re-executing the providers'
 * `useQuery`: that would flip its `fetching`, and the providers swap the whole app for a loader
 * while it is set.
 */
function useRefreshUserContext(
  setDefaults: (defaults: UserContextQuery['userContext']) => void,
): () => Promise<void> {
  const client = useClient();
  return useCallback(async () => {
    const result = await client
      .query(UserContextDocument, {}, { requestPolicy: 'network-only' })
      .toPromise();
    if (result.data) {
      setDefaults(result.data.userContext);
    }
  }, [client, setDefaults]);
}

export const UserContext = createContext<ContextType>({
  userContext: null,
  setUserContext: () => void 0,
});

const isDevAuthEnabled = import.meta.env.VITE_DEV_AUTH === '1';

export function UserProvider({ children }: { children?: ReactNode }): ReactNode {
  if (isDevAuthEnabled) {
    return <DevAuthUserProvider>{children}</DevAuthUserProvider>;
  }

  return <Auth0UserProvider>{children}</Auth0UserProvider>;
}

function Auth0UserProvider({ children }: { children?: ReactNode }): ReactNode {
  const { isAuthenticated, user: auth0User } = useAuth0();
  const [userContext, setUserContext] = useState<UserInfo | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [defaults, setDefaults] = useState<UserContextQuery['userContext']>(null);
  const refreshUserContext = useRefreshUserContext(setDefaults);

  const [{ data, fetching, error }, fetchUserContext] = useQuery({
    query: UserContextDocument,
    variables: {},
    pause: true,
  });
  const session = useMemo(() => toSessionState(data, error, fetching), [data, error, fetching]);

  // update active user
  useEffect(() => {
    const currentUser =
      isAuthenticated && auth0User
        ? {
            username: auth0User.email || auth0User.name || auth0User.nickname || 'unknown-user',
          }
        : null;

    if (!equal(currentUser, user)) {
      setUser(currentUser);
      if (currentUser) {
        fetchUserContext();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchUserContext is stable for this hook
  }, [user, isAuthenticated, auth0User]);

  // on user defaults fetched, update user defaults
  useEffect(() => {
    if (data && !fetching) {
      setDefaults(data.userContext);
    }
  }, [data, fetching]);

  // on user or defaults changed, update user context
  useEffect(() => {
    if (!user || !defaults) {
      setUserContext(null);
      return;
    }

    setUserContext({
      ...user,
      context: toUserInfoContext(defaults),
    });
  }, [defaults, user]);

  if (fetching) {
    return <AccounterLoader />;
  }

  return (
    <UserContext.Provider value={{ userContext, setUserContext, refreshUserContext, session }}>
      {children}
    </UserContext.Provider>
  );
}

function DevAuthUserProvider({ children }: { children?: ReactNode }): ReactNode {
  const [userContext, setUserContext] = useState<UserInfo | null>(null);
  const [defaults, setDefaults] = useState<UserContextQuery['userContext']>(null);
  const refreshUserContext = useRefreshUserContext(setDefaults);

  const [{ data, fetching, error }] = useQuery({
    query: UserContextDocument,
    variables: {},
    pause: false,
  });
  const session = useMemo(() => toSessionState(data, error, fetching), [data, error, fetching]);

  useEffect(() => {
    if (data && !fetching) {
      setDefaults(data.userContext);
    }
  }, [data, fetching]);

  useEffect(() => {
    if (!defaults) {
      setUserContext(null);
      return;
    }

    setUserContext({
      username: 'dev-user',
      context: toUserInfoContext(defaults),
    });
  }, [defaults]);

  if (fetching) {
    return <AccounterLoader />;
  }

  return (
    <UserContext.Provider value={{ userContext, setUserContext, refreshUserContext, session }}>
      {children}
    </UserContext.Provider>
  );
}
