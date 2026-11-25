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
 * while it is set. The providers' `useQuery` gets the answer as well, like every reader of the
 * same request on this client, so `session` follows.
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

type Defaults = UserContextQuery['userContext'];

/**
 * The user context a provider hands to the app: `user`, with what the provider's latest read of
 * the user context (`data`, `fetching`) said.
 *
 * It is kept in step with the read while rendering, not by effects after it. The app comes back
 * in the very render that takes the loader away, and screens seed their filters from the user
 * context as they mount: an effect or two later they would already have started without it, or
 * on the one before.
 *
 * A read behind the loader (`fetching`) replaces the answer before it, which was for another
 * business scope or another identity, so that one is dropped as the loader appears. A re-read in
 * the background (`refreshUserContext`) does not set `fetching`, and a failed one brings no data:
 * both leave the context as it is.
 */
function useUserContextState(
  user: User | null,
  data: UserContextQuery | undefined,
  fetching: boolean,
): {
  userContext: UserInfo | null;
  setUserContext: (userContext: UserInfo | null) => void;
  setDefaults: (defaults: Defaults) => void;
} {
  const [defaults, setDefaults] = useState<Defaults>(null);
  const [read, setRead] = useState({ data, fetching });
  if (read.data !== data || read.fetching !== fetching) {
    setRead({ data, fetching });
    if (fetching) {
      setDefaults(null);
    } else if (data) {
      setDefaults(data.userContext);
    }
  }

  const [userContext, setUserContext] = useState<UserInfo | null>(null);
  const [builtFrom, setBuiltFrom] = useState<{ user: User | null; defaults: Defaults }>({
    user: null,
    defaults: null,
  });
  if (builtFrom.user !== user || builtFrom.defaults !== defaults) {
    setBuiltFrom({ user, defaults });
    setUserContext(user && defaults ? { ...user, context: toUserInfoContext(defaults) } : null);
  }

  return { userContext, setUserContext, setDefaults };
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
  const [user, setUser] = useState<User | null>(null);

  // Read for as long as someone is signed in, rather than fetched by hand once they are: urql then
  // reads it again by itself when it gets a new client, with `fetching` set from that very render.
  // `setBusinessScope` swaps the client, and the server answers per business scope: the read
  // scope, and the single-business fields that exist only when the scope is one business.
  const [{ data, fetching, error }, readAgain] = useQuery({
    query: UserContextDocument,
    variables: {},
    pause: !user,
  });
  const session = useMemo(() => toSessionState(data, error, fetching), [data, error, fetching]);
  const { userContext, setUserContext, setDefaults } = useUserContextState(user, data, fetching);
  const refreshUserContext = useRefreshUserContext(setDefaults);

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
      if (user && currentUser) {
        // Another identity, signed in without a reload (re-authentication in place). It is the
        // same client and the same request, so urql would answer with what it has, marked stale,
        // and the app would stay up on the previous identity's screens. Read by hand, it starts
        // over behind the loader.
        readAgain({ requestPolicy: 'network-only' });
      }
    }
  }, [user, isAuthenticated, auth0User, readAgain]);

  if (fetching) {
    return <AccounterLoader />;
  }

  return (
    <UserContext.Provider value={{ userContext, setUserContext, refreshUserContext, session }}>
      {children}
    </UserContext.Provider>
  );
}

/** Who dev auth signs in as. One object, so the user context is not rebuilt on every render. */
const DEV_USER: User = { username: 'dev-user' };

function DevAuthUserProvider({ children }: { children?: ReactNode }): ReactNode {
  const [{ data, fetching, error }] = useQuery({
    query: UserContextDocument,
    variables: {},
    pause: false,
  });
  const session = useMemo(() => toSessionState(data, error, fetching), [data, error, fetching]);
  const { userContext, setUserContext, setDefaults } = useUserContextState(
    DEV_USER,
    data,
    fetching,
  );
  const refreshUserContext = useRefreshUserContext(setDefaults);

  if (fetching) {
    return <AccounterLoader />;
  }

  return (
    <UserContext.Provider value={{ userContext, setUserContext, refreshUserContext, session }}>
      {children}
    </UserContext.Provider>
  );
}
