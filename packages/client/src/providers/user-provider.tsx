import { createContext, ReactNode, useEffect, useState } from 'react';
import { User, userService } from '../services/user-service';

type ContextType = {
  userContext: UserInfo | null;
  setUserContext: (filtersContext: UserInfo | null) => void;
};

export interface UserInfo extends User {
  ownerId: string;
}

// TODO: replace with server request
export const DEFAULT_FINANCIAL_ENTITY_ID =
  import.meta.env.DEFAULT_FINANCIAL_ENTITY_ID ?? '6a20aa69-57ff-446e-8d6a-1e96d095e988';

export const UserContext = createContext<ContextType>({
  userContext: null,
  setUserContext: () => void 0,
});

export function UserProvider({ children }: { children?: ReactNode }): ReactNode {
  const [userContext, setUserContext] = useState<UserInfo | null>(null);

  const user = userService.currentUser();

  useEffect(() => {
    const userInfo: UserInfo | null = user
      ? {
          ...user,
          ownerId: DEFAULT_FINANCIAL_ENTITY_ID,
        }
      : null;

    setUserContext(userInfo);
    return;
  }, [JSON.stringify(user)]);

  return (
    <UserContext.Provider value={{ userContext, setUserContext }}>{children}</UserContext.Provider>
  );
}
