import { z } from 'zod';
import type { SecuritiesTaxCategoryKey } from '../../../__generated__/types.js';

/**
 * `accounter_schema.user_context.securities_context`: the tenant's securities ledger
 * configuration, kept as jsonb so new securities settings can be added without a column each.
 * Stored shape (camelCase keys, every field optional):
 *
 *   {
 *     "foreignSecuritiesBusinessId": "<uuid>",
 *     "sortCode": 990,
 *     "taxCategories": { "foreignSecuritiesFees": "<uuid>", "foreignDividendIncome": "<uuid>", ... }
 *   }
 *
 * It supersedes the deprecated `user_context.foreign_securities_business_id` and
 * `user_context.foreign_securities_fees_category_id` columns, whose values were copied in; those are
 * no longer read or written.
 *
 * jsonb carries no foreign keys, so ids are validated on write (see `updateSecuritiesContext`)
 * and a dangling one surfaces at ledger time as an unbalanced or unknown account.
 */

const SECURITIES_TAX_CATEGORIES = {
  // formerly `user_context.foreign_securities_fees_category_id`
  FOREIGN_SECURITIES_FEES: { field: 'foreignSecuritiesFees', label: 'Foreign securities fees' },
  FOREIGN_DIVIDEND_INCOME: { field: 'foreignDividendIncome', label: 'Foreign dividend income' },
  LOCAL_DIVIDEND_INCOME: { field: 'localDividendIncome', label: 'Local dividend income' },
  // formerly `dividendWithholdingTax`, which the migration moved here
  FOREIGN_DIVIDEND_WITHHOLDING_TAX: {
    field: 'foreignDividendWithholdingTax',
    label: 'Foreign dividend withholding tax',
  },
  LOCAL_DIVIDEND_WITHHOLDING_TAX: {
    field: 'localDividendWithholdingTax',
    label: 'Local dividend withholding tax',
  },
  FOREIGN_BOND_INTEREST_INCOME: {
    field: 'foreignBondInterestIncome',
    label: 'Foreign bond interest income',
  },
  LOCAL_BOND_INTEREST_INCOME: {
    field: 'localBondInterestIncome',
    label: 'Local bond interest income',
  },
  // formerly `bondWithholdingTax`, which the migration moved here
  FOREIGN_BOND_WITHHOLDING_TAX: {
    field: 'foreignBondWithholdingTax',
    label: 'Foreign bond withholding tax',
  },
  LOCAL_BOND_WITHHOLDING_TAX: {
    field: 'localBondWithholdingTax',
    label: 'Local bond withholding tax',
  },
  FOREIGN_SECURITIES_SALE_GAIN: {
    field: 'foreignSecuritiesSaleGain',
    label: 'Gain from sale of foreign securities',
  },
  FOREIGN_SECURITIES_SALE_LOSS: {
    field: 'foreignSecuritiesSaleLoss',
    label: 'Loss from sale of foreign securities',
  },
  // the exchange-rate part of a sale's PnL, apart from the price part above
  FOREIGN_SECURITIES_SALE_EXCHANGE_GAIN: {
    field: 'foreignSecuritiesSaleExchangeGain',
    label: 'Exchange rate gain on sale of foreign securities',
  },
  FOREIGN_SECURITIES_SALE_EXCHANGE_LOSS: {
    field: 'foreignSecuritiesSaleExchangeLoss',
    label: 'Exchange rate loss on sale of foreign securities',
  },
} as const satisfies Record<SecuritiesTaxCategoryKey, { field: string; label: string }>;

export const SECURITIES_TAX_CATEGORY_KEYS = Object.keys(
  SECURITIES_TAX_CATEGORIES,
) as SecuritiesTaxCategoryKey[];

/** The human name of a securities tax category, as ledger errors and new categories call it */
export function securitiesTaxCategoryLabel(key: SecuritiesTaxCategoryKey): string {
  return SECURITIES_TAX_CATEGORIES[key].label;
}

export type SecuritiesTaxCategoryIds = Partial<Record<SecuritiesTaxCategoryKey, string>>;

export type SecuritiesContext = {
  /**
   * The general foreign-securities business (formerly
   * `user_context.foreign_securities_business_id`)
   */
  foreignSecuritiesBusinessId: string | null;
  /** The sort code new securities tax categories are created under */
  sortCode: number | null;
  taxCategories: SecuritiesTaxCategoryIds;
};

export const EMPTY_SECURITIES_CONTEXT: Readonly<SecuritiesContext> = Object.freeze({
  foreignSecuritiesBusinessId: null,
  sortCode: null,
  taxCategories: Object.freeze({}),
});

const emptySecuritiesContext = (): SecuritiesContext => ({
  foreignSecuritiesBusinessId: null,
  sortCode: null,
  taxCategories: {},
});

type StoredTaxCategoryField = (typeof SECURITIES_TAX_CATEGORIES)[SecuritiesTaxCategoryKey]['field'];

export type StoredSecuritiesContext = {
  foreignSecuritiesBusinessId?: string;
  sortCode?: number;
  taxCategories: Partial<Record<StoredTaxCategoryField, string>>;
};

const sortCodeSchema = z.number().int().positive();
const idSchema = z.guid();

// Per-field `.catch` so one bad value degrades that field alone: this is read by
// `getVerifiedAdminContext`, which nearly every request goes through, so it must never throw.
const storedSecuritiesContextSchema = z.object({
  foreignSecuritiesBusinessId: idSchema.nullish().catch(null),
  sortCode: sortCodeSchema.nullish().catch(null),
  taxCategories: z
    .object(
      Object.fromEntries(
        SECURITIES_TAX_CATEGORY_KEYS.map(key => [
          SECURITIES_TAX_CATEGORIES[key].field,
          idSchema.optional().catch(undefined),
        ]),
      ),
    )
    .nullish()
    .catch(null),
});

/** Lenient read of the stored jsonb: unknown keys are ignored and bad values dropped */
export function parseStoredSecuritiesContext(input: unknown): SecuritiesContext {
  if (input == null) {
    return emptySecuritiesContext();
  }
  const { data, success, error } = storedSecuritiesContextSchema.safeParse(input);
  if (!success) {
    // Reached only when the value is not an object at all — the per-field `.catch` above
    // absorbs everything else.
    console.error(`Ignoring unparsable stored securities context: ${error}`);
    return emptySecuritiesContext();
  }

  const taxCategories: SecuritiesTaxCategoryIds = {};
  for (const key of SECURITIES_TAX_CATEGORY_KEYS) {
    const id = data.taxCategories?.[SECURITIES_TAX_CATEGORIES[key].field];
    if (id) {
      taxCategories[key] = id;
    }
  }
  return {
    foreignSecuritiesBusinessId: data.foreignSecuritiesBusinessId ?? null,
    sortCode: data.sortCode ?? null,
    taxCategories,
  };
}

/** The stored jsonb shape of a context, leaving unset fields out */
export function serializeSecuritiesContext(context: SecuritiesContext): StoredSecuritiesContext {
  const taxCategories: StoredSecuritiesContext['taxCategories'] = {};
  for (const key of SECURITIES_TAX_CATEGORY_KEYS) {
    const id = context.taxCategories[key];
    if (id) {
      taxCategories[SECURITIES_TAX_CATEGORIES[key].field] = id;
    }
  }
  return {
    ...(context.foreignSecuritiesBusinessId
      ? { foreignSecuritiesBusinessId: context.foreignSecuritiesBusinessId }
      : {}),
    ...(context.sortCode == null ? {} : { sortCode: context.sortCode }),
    taxCategories,
  };
}

const securitiesContextPatchSchema = z.object({
  foreignSecuritiesBusinessId: idSchema.nullish(),
  sortCode: sortCodeSchema.nullish(),
  taxCategories: z
    .array(
      z.object({
        key: z.enum(SECURITIES_TAX_CATEGORY_KEYS as [SecuritiesTaxCategoryKey]),
        taxCategoryId: idSchema.nullable(),
      }),
    )
    .nullish(),
});

/**
 * A change to the context. An omitted field is left as is; `null` clears it — `sortCode: null`
 * forgets the sort code, `taxCategoryId: null` unassigns that key.
 */
export type SecuritiesContextPatch = z.infer<typeof securitiesContextPatchSchema>;

/** Strict validation for the write path: throws on anything malformed */
export function parseSecuritiesContextPatch(input: unknown): SecuritiesContextPatch {
  return securitiesContextPatchSchema.parse(input);
}

export function mergeSecuritiesContext(
  current: SecuritiesContext,
  patch: SecuritiesContextPatch,
): SecuritiesContext {
  const taxCategories: SecuritiesTaxCategoryIds = { ...current.taxCategories };
  for (const { key, taxCategoryId } of patch.taxCategories ?? []) {
    if (taxCategoryId) {
      taxCategories[key] = taxCategoryId;
    } else {
      delete taxCategories[key];
    }
  }

  return {
    foreignSecuritiesBusinessId:
      patch.foreignSecuritiesBusinessId === undefined
        ? current.foreignSecuritiesBusinessId
        : patch.foreignSecuritiesBusinessId,
    sortCode: patch.sortCode === undefined ? current.sortCode : patch.sortCode,
    taxCategories,
  };
}
