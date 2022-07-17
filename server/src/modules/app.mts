import { config } from 'dotenv';
import { createApplication } from 'graphql-modules'
import { Pool } from 'pg';

config();

import { financialEntitiesModule } from './financial-entities/index.mjs'

export function createGraphQLApp() {
    return createApplication({
      modules: [financialEntitiesModule],
      providers: [
        {
          provide: Pool,
          useFactory: () =>
            new Pool({
              connectionString: process.env.PGURI,
              ssl: {
                rejectUnauthorized: false,
              },
            })
        },]
    })
}
