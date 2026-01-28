import { InjectionToken } from 'graphql-modules';
import type { AuthContext } from './types/auth.js';
import type { Environment } from './types/index.js';

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');
export const AUTH_CONTEXT = new InjectionToken<AuthContext>('AUTH_CONTEXT');
