import type { IsracardCardsTransactionsList } from '@accounter/modern-poalim-scraper';

type CardsTransactionsListBean = IsracardCardsTransactionsList['CardsTransactionsListBean'];

/**
 * Wraps a raw `CardsTransactionsListBean` in a successful Isracard/Amex response.
 *
 * The bean is an index-signature of deeply-nested card records; tests deliberately build partial
 * and malformed variants of it to exercise identifier extraction, so it is passed through as-is.
 */
export function makeIsracardPayload(
  bean: Record<string, unknown>,
): IsracardCardsTransactionsList {
  return {
    Header: { Status: '1', Message: null },
    CardsTransactionsListBean: bean as CardsTransactionsListBean,
  };
}
