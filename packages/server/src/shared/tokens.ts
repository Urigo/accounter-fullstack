import { InjectionToken } from 'graphql-modules';
import type { AdminContext } from '../plugins/admin-context-plugin.js';
import type { RawAuth } from '../plugins/auth-plugin-v2.js';
import type { AuthContext } from './types/auth.js';
import type { Environment } from './types/index.js';

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');
export const AUTH_CONTEXT = new InjectionToken<AuthContext>('AUTH_CONTEXT');
export const AUTH_CONTEXT_V2 = new InjectionToken<AuthContext | null>('AUTH_CONTEXT_V2');
export const ADMIN_CONTEXT = new InjectionToken<AdminContext | null>('AdminContext');
export const RAW_AUTH = new InjectionToken<RawAuth>('RAW_AUTH');
