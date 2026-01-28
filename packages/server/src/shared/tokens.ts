import { InjectionToken } from 'graphql-modules';
import type { RawAuth } from '../plugins/auth-plugin-v2.js';
import type { AuthContext } from './types/auth.js';
import type { Environment } from './types/index.js';

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');
export const AUTH_CONTEXT = new InjectionToken<AuthContext>('AUTH_CONTEXT');
export const AUTH_CONTEXT_V2 = new InjectionToken<AuthContext>('AUTH_CONTEXT_V2');
export const RAW_AUTH = new InjectionToken<RawAuth>('RAW_AUTH');
