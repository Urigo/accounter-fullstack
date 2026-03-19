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
      adminBusinessId
      defaultLocalCurrency
      defaultCryptoConversionFiatCurrency
      ledgerLock
      financialAccountsBusinessesIds
      locality
      roleId
    }
  }
`;

type ContextType = {
  userContext: UserInfo | null;
  setUserContext: (filtersContext: UserInfo | null) => void;
};

export interface UserInfo extends User {
  context: {
    adminBusinessId: string;
    defaultLocalCurrency: string;
    defaultCryptoConversionFiatCurrency: string;
    ledgerLock?: string | null;
    financialAccountsBusinessesIds: string[];
    locality: string;
    roleId: string;
  };
}

type User = {
  username: string;
};

export const UserContext = createContext<ContextType>({
  userContext: null,
  setUserContext: () => void 0,
});

export function UserProvider({ children }: { children?: ReactNode }): ReactNode {
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
      context: defaults,
    });
  }, [defaults, user]);

  if (fetching) {
    return <AccounterLoader />;
  }

  return (
    <UserContext.Provider value={{ userContext, setUserContext }}>{children}</UserContext.Provider>
  );
}
