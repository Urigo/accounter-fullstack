import { createContext, useEffect, useState, type ReactNode } from 'react';
import equal from 'deep-equal';
import { useQuery } from 'urql';
import { useAuth0 } from '@auth0/auth0-react';
import { AccounterLoader } from '../components/common/loaders/loader.js';
import { UserContextDocument, type UserContextQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query UserContext {
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
      locality
    }
  }
`;

type ContextType = {
  userContext: UserInfo | null;
  setUserContext: (filtersContext: UserInfo | null) => void;
};

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
    locality: userContext.locality ?? '',
  };
}

type User = {
  username: string;
};

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

  const [{ data, fetching }, fetchUserContext] = useQuery({
    query: UserContextDocument,
    variables: {},
    pause: true,
  });

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
    <UserContext.Provider value={{ userContext, setUserContext }}>{children}</UserContext.Provider>
  );
}

function DevAuthUserProvider({ children }: { children?: ReactNode }): ReactNode {
  const [userContext, setUserContext] = useState<UserInfo | null>(null);
  const [defaults, setDefaults] = useState<UserContextQuery['userContext']>(null);

  const [{ data, fetching }] = useQuery({
    query: UserContextDocument,
    variables: {},
    pause: false,
  });

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
    <UserContext.Provider value={{ userContext, setUserContext }}>{children}</UserContext.Provider>
  );
}
