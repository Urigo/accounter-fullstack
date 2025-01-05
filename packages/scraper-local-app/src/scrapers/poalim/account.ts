import Listr from 'listr';
import type { ScrapedAccount } from './accounts.js';
import { getForeignTransactions } from './foreign-transactions.js';
import { getIlsTransactions } from './ils-transactions.js';
import type { PoalimUserContext } from './index.js';
import { getSwiftTransactions } from './swift-transactions.js';

export async function handlePoalimAccount(account: ScrapedAccount, bankKey: string) {
  return new Listr<PoalimUserContext>(
    [
      {
        title: 'Get ILS transactions',
        enabled: ctx =>
          !!ctx[bankKey]?.scraper && !!ctx[bankKey]?.columns?.['poalim_ils_account_transactions'],
        task: async () => getIlsTransactions(bankKey, account),
      },
      {
        title: 'Get foreign transactions',
        enabled: ctx => !!ctx[bankKey]?.scraper,
        task: async () => getForeignTransactions(bankKey, account),
      },
      {
        title: 'Get Swift transactions',
        enabled: ctx => !!ctx[bankKey]?.scraper,
        task: async () => getSwiftTransactions(bankKey, account),
      },
    ],
    { concurrent: true },
  );
}
