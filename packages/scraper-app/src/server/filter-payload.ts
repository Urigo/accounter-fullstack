import type { z } from 'zod';
import type { IsracardCardsTransactionsList } from '@accounter/modern-poalim-scraper';
import type { SourceType, ValidatedPayload } from './check-accounts.js';
import type { CalPayload } from './payload-schemas/cal.schema.js';
import type { DiscountPayload } from './payload-schemas/discount.schema.js';
import type { MaxPayload } from './payload-schemas/max.schema.js';
import type { PoalimForeignPayload } from './payload-schemas/poalim-foreign.schema.js';
import type { PoalimIlsPayload } from './payload-schemas/poalim-ils.schema.js';
import type { PoalimSwiftPayload } from './payload-schemas/poalim-swift.schema.js';
import type {
  CalAccountSchema,
  DiscountAccountSchema,
  IsracardAmexAccountSchema,
  MaxAccountSchema,
  PoalimAccountSchema,
} from './vault.js';

export type FilterableCreds =
  | z.infer<typeof PoalimAccountSchema>
  | z.infer<typeof IsracardAmexAccountSchema>
  | z.infer<typeof CalAccountSchema>
  | z.infer<typeof MaxAccountSchema>
  | z.infer<typeof DiscountAccountSchema>;

function effectiveSet(
  accepted: string[] | undefined,
  ignored: string[] | undefined,
  all: string[],
): Set<string> {
  const base = accepted?.length ? accepted : all;
  const ignoredSet = new Set(ignored ?? []);
  return new Set(base.filter(c => !ignoredSet.has(c)));
}

function filterIsracardAmex(
  payload: IsracardCardsTransactionsList,
  accepted: string[] | undefined,
  ignored: string[] | undefined,
): IsracardCardsTransactionsList {
  const bean = payload.CardsTransactionsListBean;
  const allCards = bean.cardNumberList.map(c => c.match(/\d{4}/)?.[0]);

  const allowed = effectiveSet(accepted, ignored, allCards.filter(Boolean) as string[]);

  const filteredBean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(bean)) {
    if (/^Index\d+$/.test(key)) {
      const card = allCards[Number(key.slice(5))]; // 'Index0' → 0 → cardNumbers[0]
      if (!card || !allowed.has(card)) {
        continue;
      }
    }
    filteredBean[key] = val;
  }

  return {
    ...payload,
    CardsTransactionsListBean:
      filteredBean as IsracardCardsTransactionsList['CardsTransactionsListBean'],
  };
}

export function filterPayload(
  type: SourceType,
  payload: ValidatedPayload,
  creds: FilterableCreds,
): ValidatedPayload {
  switch (type) {
    case 'isracard':
    case 'amex': {
      const p = payload as IsracardCardsTransactionsList;
      const opts = (creds as z.infer<typeof IsracardAmexAccountSchema>).options;
      return filterIsracardAmex(
        p,
        opts?.acceptedCardNumbers,
        opts?.ignoredCardNumbers,
      ) as IsracardCardsTransactionsList;
    }

    case 'cal': {
      const p = payload as CalPayload;
      const opts = (creds as z.infer<typeof CalAccountSchema>).options;
      const allCards = [...new Set(p.map(e => e.card))];
      const allowed = effectiveSet(opts?.acceptedCardNumbers, opts?.ignoredCardNumbers, allCards);
      return p.filter(e => allowed.has(e.card));
    }

    case 'max': {
      const p = payload as MaxPayload;
      const opts = (creds as z.infer<typeof MaxAccountSchema>).options;
      const allAccounts = [...new Set(p.map(e => e.accountNumber))];
      const allowed = effectiveSet(
        opts?.acceptedCardNumbers,
        opts?.ignoredCardNumbers,
        allAccounts,
      );
      return p.filter(e => allowed.has(e.accountNumber));
    }

    case 'poalim': {
      const opts = (creds as z.infer<typeof PoalimAccountSchema>).options;
      // PoalimIls has retrievalTransactionData; Foreign has balancesAndLimitsDataList; Swift has swiftsList
      if ('retrievalTransactionData' in payload) {
        const p = payload as PoalimIlsPayload;
        const { accountNumber, branchNumber } = p.retrievalTransactionData;
        const allAccounts = [String(accountNumber)];
        const allBranches = [String(branchNumber)];
        const allowedAccounts = effectiveSet(
          opts?.acceptedAccountNumbers,
          opts?.ignoredAccountNumbers,
          allAccounts,
        );
        const allowedBranches = effectiveSet(
          opts?.acceptedBranchNumbers,
          opts?.ignoredBranchNumbers,
          allBranches,
        );
        if (
          !allowedAccounts.has(String(accountNumber)) ||
          !allowedBranches.has(String(branchNumber))
        ) {
          return { ...p, transactions: [] };
        }
        return p;
      }
      if ('balancesAndLimitsDataList' in payload) {
        // Foreign payloads carry no account/branch identifiers — account-level filtering
        // is handled by the caller, which correlates each Foreign payload with its
        // positionally-matched ILS payload (which does carry the identifiers).
        return payload as PoalimForeignPayload;
      }
      if ('swiftsList' in payload) {
        // Swift payloads carry no account/branch identifiers — same as Foreign above.
        return payload as PoalimSwiftPayload;
      }
      return payload;
    }

    case 'discount': {
      // No filter options for discount
      const p = payload as DiscountPayload;
      return p;
    }
  }
}
