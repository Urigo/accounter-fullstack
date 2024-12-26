import Listr from 'listr';
import type { Pool } from 'pg';
import type { ScrapedAccount } from './accounts.js';
import { getIlsTransactions } from './ils-transactions.js';
import type { PoalimContext } from './index.js';

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
    ],
    { concurrent: true },
  );
}
