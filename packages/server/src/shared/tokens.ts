import { InjectionToken } from 'graphql-modules';
import type { Environment } from './types';

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');
