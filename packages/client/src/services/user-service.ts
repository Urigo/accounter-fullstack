export type User = {
  authdata?: string;
  username: string;
};

function authToken(): string | null {
  try {
    // return authorization header with basic auth credentials
    const user: User = JSON.parse(localStorage.getItem('user')!);

    if (user?.authdata) {
      return `Basic ${user.authdata}`;
    }
  } catch (e) {
    /* empty */
  }
  return null;
}

export const userService = {
  login,
  logout,
  authToken,
  isLoggedIn,
  currentUser,
};

async function login(username: string, password: string): Promise<User> {
  if (username && password) {
    const authdata = btoa(`${username}:${password}`);
    const user: User = { username, authdata };
    // to keep user logged in between page refreshes
    localStorage.setItem('user', JSON.stringify(user));

    return user;
  }

  throw new Error('Username or password is incorrect');
}

function logout(): void {
  // remove token from local storage to log user out
  localStorage.removeItem('user');
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('user');
}

export function currentUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem('user')!);
  } catch (e) {
    /* empty */
  }
  return null;
}
