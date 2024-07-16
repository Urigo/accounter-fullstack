import { InjectionToken } from 'graphql-modules';
import type { Environment } from './types/index.js';

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');
