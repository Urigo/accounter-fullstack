import { GraphQLError } from 'graphql';
import { Inject, Injectable, Scope } from 'graphql-modules';
import type { AuthUser } from '../../../shared/types/auth.js';
import { AuthContextProvider } from './auth-context.provider.js';

@Injectable({ scope: Scope.Operation, global: true })
export class AuthorizationProvider {
  constructor(@Inject(AuthContextProvider) protected authProvider: AuthContextProvider) {}

  async requireAuth(): Promise<AuthUser> {
    const auth = await this.authProvider.getAuthContext();
    if (!auth?.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    return auth.user;
  }

  async requireRole(allowedRoles: string[]): Promise<AuthUser> {
    const user = await this.requireAuth();
    if (!allowedRoles.includes(user.roleId)) {
      throw new GraphQLError(`Access denied. Required roles: ${allowedRoles.join(', ')}`, {
        extensions: { code: 'FORBIDDEN' },
      });
    }
    return user;
  }

  async requireBusinessOwner(): Promise<AuthUser> {
    return this.requireRole(['business_owner']);
  }

  async canWrite(): Promise<AuthUser> {
    // Employee is read-only; scraper is excluded unless a domain service explicitly allows it.
    return this.requireRole(['business_owner', 'accountant']);
  }

  async canManageUsers(): Promise<AuthUser> {
    return this.requireRole(['business_owner']);
  }
}
