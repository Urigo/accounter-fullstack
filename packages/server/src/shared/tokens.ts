import { InjectionToken } from 'graphql-modules';
import type { RawAuth } from '../plugins/auth-plugin.js';
import type { Environment } from './types/index.js';

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');
export const RAW_AUTH = new InjectionToken<RawAuth>('RAW_AUTH');
