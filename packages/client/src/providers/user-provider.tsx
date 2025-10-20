import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import equal from 'deep-equal';
import { useQuery } from 'urql';
import { AccounterLoader } from '../components/common/index.js';
import { UserContextDocument, type UserContextQuery } from '../gql/graphql.js';
import { type User } from '../services/user-service.js';
import { AuthContext } from './auth-guard.js';

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
  };
}

export const UserContext = createContext<ContextType>({
  userContext: null,
  setUserContext: () => void 0,
});

export function UserProvider({ children }: { children?: ReactNode }): ReactNode {
  const { authService } = useContext(AuthContext);
  const [userContext, setUserContext] = useState<UserInfo | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [defaults, setDefaults] = useState<UserContextQuery['userContext']>(null);

  const [{ data, fetching }, fetchUserContext] = useQuery({
    query: UserContextDocument,
    variables: {},
    pause: true,
  });

  // update active user
  const currentUser = authService.currentUser();
  useEffect(() => {
    if (!equal(currentUser, user)) {
      setUser(currentUser);
      fetchUserContext();
    }
  }, [currentUser, user, fetchUserContext]);

  // on user defaults fetched, update user defaults
  useEffect(() => {
    if (data && !fetching) {
      setDefaults(data.userContext);
    }
  }, [data, fetching]);

  // on user or defaults changed, update user context
  useEffect(() => {
    if (user && defaults) {
      const userInfo: UserInfo | null =
        user && defaults
          ? {
              ...user,
              context: defaults,
            }
          : null;

      setUserContext(userInfo);
    }
    return;
  }, [defaults, user]);

  if (fetching) {
    return <AccounterLoader />;
  }

  return (
    <UserContext.Provider value={{ userContext, setUserContext }}>{children}</UserContext.Provider>
  );
}
