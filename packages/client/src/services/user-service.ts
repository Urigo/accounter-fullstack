export interface User {
  authdata?: string;
  username: string;
}

export class UserService {
  private user: User | null = null;

  constructor() {
    try {
      const storageUser = JSON.parse(localStorage.getItem('user')!);
      this.user = storageUser;
    } catch (e) {
      console.error(e);
    }
  }

  public authToken(): string | null {
    // return authorization header with basic auth credentials
    const user = this.currentUser();
    if (user?.authdata) {
      return `Basic ${user.authdata}`;
    }
    return null;
  }

  public async login(username: string, password: string): Promise<User> {
    if (username && password) {
      const authdata = btoa(`${username}:${password}`);
      const user: User = { username, authdata };
      // to keep user logged in between page refreshes
      localStorage.setItem('user', JSON.stringify(user));

      this.user = user;
      return user;
    }

    throw new Error('Username or password is incorrect');
  }

  public logout(): void {
    // remove token from local storage to log user out
    localStorage.removeItem('user');

    this.user = null;
  }

  public isLoggedIn(): boolean {
    console.log('isLoggedIn', !!this.user);
    return !!this.user;
  }

  public currentUser(): User | null {
    if (!this.user) {
      try {
        const storageUser = JSON.parse(localStorage.getItem('user')!);
        this.user = storageUser;
      } catch (e) {
        console.error(e);
      }
    }
    return this.user;
  }
}
