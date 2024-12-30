import Listr from 'listr';
import type { Pool } from 'pg';
import type { ScrapedAccount } from './accounts.js';
import { getForeignTransactions } from './foreign-transactions.js';
import { getIlsTransactions } from './ils-transactions.js';
import type { PoalimContext } from './index.js';
import { getSwiftTransactions } from './swift-transactions.js';

export async function handlePoalimAccount(
  account: ScrapedAccount,
  pool: Pool,
  parentCtx: PoalimContext,
) {
  return new Listr<unknown>(
    [
      {
        title: 'Get ILS transactions',
        enabled: () =>
          !!parentCtx.scraper && !!parentCtx.columns?.['poalim_ils_account_transactions'],
        task: async () => getIlsTransactions(pool, account, parentCtx),
      },
      {
        title: 'Get foreign transactions',
        enabled: () => !!parentCtx.scraper,
        task: async () => getForeignTransactions(pool, account, parentCtx),
      },
      {
        title: 'Get Swift transactions',
        enabled: () => !!parentCtx.scraper,
        task: async () => getSwiftTransactions(pool, account, parentCtx),
      },
    ],
    { concurrent: true },
  );
}
