import { z } from 'zod';

/**
 * One executed activity inside a securities portfolio, from the "mytrade" order
 * executions history API (`Account.Execution[]`): buys, sells, dividend and
 * interest payments, redemptions and other corporate actions.
 *
 * The schema is deliberately as tight as the observed responses allow — closed
 * enums, date/identifier formats, value ranges, and the cross-field invariants
 * the bank's own data obeys — so that a bank-side change is a loud, located
 * failure rather than a silently mis-typed column downstream. Every constraint
 * carries a message naming the field, the offending value, and what to widen.
 *
 * Field names — including `IsraeTaxValue`, `PeymentPecentage`,
 * `TradeCurrnecyRate`, `LastTranactionDate` and
 * `FundPlusAccumulatedInerestValue` — are the bank's own spellings.
 */

/** Renders an unexpected value for an error message without ever throwing. */
function describeInput(input: unknown): string {
  if (input === undefined) return 'nothing (the key is missing)';
  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
    return JSON.stringify(input);
  }
  if (input === null) return 'null';
  if (Array.isArray(input)) return `an array of ${input.length}`;
  return typeof input;
}

const quoted = (values: readonly string[]) => values.map(value => `"${value}"`).join(', ');

/**
 * A closed set of Hebrew/English labels the bank sends. Extending one of these
 * lists is the intended fix when the message below fires — the values are the
 * bank's vocabulary, not ours.
 */
function poalimEnum<const T extends readonly [string, ...string[]]>(
  field: string,
  values: T,
  constant: string,
) {
  return z.enum(values, {
    error: issue =>
      `${field}: unexpected value ${describeInput(issue.input)}. Known values are ${quoted(values)} — if the bank started sending another, add it to ${constant}.`,
  });
}

/** `z.number()` already rejects NaN and Infinity, so a plain number is finite. */
function poalimNumber(field: string) {
  return z.number({
    error: issue => `${field}: expected a finite number, got ${describeInput(issue.input)}.`,
  });
}

/** Amounts, quantities and prices the bank never sends below zero. */
function nonNegativeNumber(field: string) {
  return poalimNumber(field).min(0, {
    error: issue => `${field}: expected a value of 0 or more, got ${describeInput(issue.input)}.`,
  });
}

/** A rate expressed in percent — 23 means 23%, never 0.23. */
function percentNumber(field: string) {
  return poalimNumber(field)
    .min(0, {
      error: issue =>
        `${field}: expected a percentage of 0 or more, got ${describeInput(issue.input)}.`,
    })
    .max(100, {
      error: issue =>
        `${field}: expected a percentage of at most 100 — ${describeInput(issue.input)} suggests the bank switched to a fraction (0-1) or another unit.`,
    });
}

function nonEmptyString(field: string, description: string) {
  return z
    .string({
      error: issue => `${field}: expected ${description}, got ${describeInput(issue.input)}.`,
    })
    .min(1, { error: `${field}: expected ${description}, got an empty string.` });
}

/**
 * `.NET` round-trip timestamps: `2026-08-11T00:00:00.0000000+03:00`. Every
 * observed value is midnight, but only the shape is enforced — a real intraday
 * execution timestamp is a plausible bank-side addition and parses the same.
 * `ExecutionDate` uses the offset-less `0001-01-01T00:00:00.0000000` sentinel,
 * hence the optional offset.
 */
const POALIM_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}([+-]\d{2}:\d{2})?$/;

function poalimDateTime(field: string) {
  return z
    .string({
      error: issue => `${field}: expected a date string, got ${describeInput(issue.input)}.`,
    })
    .regex(POALIM_DATE_TIME_RE, {
      error: issue =>
        `${field}: ${describeInput(issue.input)} is not a Poalim timestamp (expected yyyy-MM-ddTHH:mm:ss.fffffff with an optional ±hh:mm offset).`,
    });
}

/**
 * Null in every observed row. Typed as `null` rather than "optional string" on
 * purpose: if the bank starts populating it we want to hear about it and decide
 * how to store it, not quietly drop the value.
 */
function alwaysNull(field: string) {
  return z.null({
    error: issue =>
      `${field}: was null in every observed response and is typed as null, but this one carries ${describeInput(issue.input)}. Give the field a real type here and in the ingestion pipe (GraphQL input + poalim_securities_transactions column).`,
  });
}

// ── The bank's closed vocabularies ────────────────────────────────────────────

/** Answers to the bank's yes/no flags. */
const HEBREW_YES_NO = ['כן', 'לא'] as const;

const TRANSACTION_TYPES = ['קניה', 'מכירה', 'תשלומים ואירועי חברה', 'העברות'] as const;

const TRADE_TYPES = [
  'קניה',
  'מכירה',
  'דבידנד תשלום',
  'ריבית תשלום',
  'פדיון',
  'הטבה חלוקת מניות',
  'העברה לזכות הפקדון',
  'העברה לחובת הפקדון',
  'העברה לחובת הפקדון (דו צדדית)',
  // Not yet observed, but the bank pairs every "לחובת" transfer with a "לזכות"
  // one; listed so the credit side of a two-sided transfer does not fail a scrape.
  'העברה לזכות הפקדון (דו צדדית)',
] as const;

/** The `TradeType`s that mean a position was bought or sold outright. */
const TRADING_TRADE_TYPES: ReadonlySet<string> = new Set(['קניה', 'מכירה']);

/** Set on corporate actions; note `פידיון` here vs `פדיון` in TRADE_TYPES. */
const PAYMENT_TYPES = [
  'דיבידנד',
  'דיבידנד בעין',
  'ריבית',
  'פידיון',
  'פקיעה',
  'איחוד מניות',
  'הצעת רכש כפויה',
] as const;

/**
 * The bank spells currencies out in Hebrew. Every value here must also be
 * mapped in `formatCurrency` (`packages/server/src/shared/helpers/amount.ts`),
 * which turns the label into a `Currency` when the executions are read back —
 * widening this list alone only moves the failure downstream.
 */
const CURRENCIES = [
  'שקל חדש', // ILS
  'דולר ארה"ב', // USD
  'אירו', // EUR
  'לירה שטרלינג', // GBP
  'ין יפני', // JPY
] as const;

const SECURITY_GROUPS = [
  'מניות ניע"ז',
  'אג"ח ממשלתי ניע"ז',
  'אג"ח קונצרני ניע"ז',
  'תעודת סל ETF ניע"ז',
  'קרן נאמנות',
  'קרנות נאמנות זרות',
] as const;

/** Only tradable securities were observed; see the message on the enum. */
const TRADABILITY = ['סחיר'] as const;

const PoalimSecurityTransactionFields = z.strictObject({
  // ── identity ────────────────────────────────────────────────────────────────
  /** Poalim's security number; joins to the reference feed's `-Key`. */
  Security: nonEmptyString('Security', "the bank's security number").regex(/^\d{7,8}$/, {
    error: issue =>
      `Security: expected a 7- or 8-digit Poalim security number, got ${describeInput(issue.input)}.`,
  }),
  TradeDate: poalimDateTime('TradeDate'),
  ValueDate: poalimDateTime('ValueDate').nullable(),
  SettlementDate: poalimDateTime('SettlementDate').nullable(),
  TradeType: poalimEnum('TradeType', TRADE_TYPES, 'TRADE_TYPES'),
  TransactionType: poalimEnum('TransactionType', TRANSACTION_TYPES, 'TRANSACTION_TYPES'),
  /** Nominal value / quantity. Zero on corporate actions that move no units. */
  NV: nonNegativeNumber('NV').nullable(),
  TradePrice: nonNegativeNumber('TradePrice').nullable(),
  /** Signed: negative on a buy, positive on a sale or a payment received. */
  NetValueTradeCurrency: poalimNumber('NetValueTradeCurrency').nullable(),
  PaymentType: poalimEnum('PaymentType', PAYMENT_TYPES, 'PAYMENT_TYPES').nullable(),
  PaymentDate: poalimDateTime('PaymentDate').nullable(),
  ExDate: poalimDateTime('ExDate').nullable(),
  CancelDate: poalimDateTime('CancelDate').nullable(),

  // ── account ─────────────────────────────────────────────────────────────────
  Branch: poalimNumber('Branch')
    .int()
    .positive({
      error: issue =>
        `Branch: expected a positive branch number, got ${describeInput(issue.input)}.`,
    }),
  Account: poalimNumber('Account')
    .int()
    .positive({
      error: issue =>
        `Account: expected a positive account number, got ${describeInput(issue.input)}.`,
    }),
  AccountName: nonEmptyString('AccountName', "the account holder's name").nullable(),
  /** The branch that executed the order — often a trading desk, not the account's. */
  ExecutingBranch: nonEmptyString('ExecutingBranch', 'a numeric branch string')
    .regex(/^\d+$/, {
      error: issue => `ExecutingBranch: expected digits only, got ${describeInput(issue.input)}.`,
    })
    .nullable(),
  FinancialAccountBranch: nonEmptyString('FinancialAccountBranch', 'a numeric branch string')
    .regex(/^\d+$/, {
      error: issue =>
        `FinancialAccountBranch: expected digits only, got ${describeInput(issue.input)}.`,
    })
    .nullable(),
  FinancialAccountNumber: nonEmptyString('FinancialAccountNumber', 'a numeric account string')
    .regex(/^\d+$/, {
      error: issue =>
        `FinancialAccountNumber: expected digits only, got ${describeInput(issue.input)}.`,
    })
    .nullable(),

  // ── security descriptors ────────────────────────────────────────────────────
  /** ISO 6166: 2-letter prefix, 9 alphanumerics, check digit. */
  ISIN: nonEmptyString('ISIN', 'an ISIN')
    .regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/, {
      error: issue =>
        `ISIN: ${describeInput(issue.input)} is not a 12-character ISIN (2 letters, 9 alphanumerics, 1 check digit).`,
    })
    .nullable(),
  Symbol: nonEmptyString('Symbol', 'a ticker symbol').max(30, {
    error: issue => `Symbol: expected at most 30 characters, got ${describeInput(issue.input)}.`,
  }),
  SymbolOSI: nonEmptyString('SymbolOSI', 'an exchange-qualified ticker')
    .max(30, {
      error: issue =>
        `SymbolOSI: expected at most 30 characters, got ${describeInput(issue.input)}.`,
    })
    .nullable(),
  // The bank truncates names to 30 characters and sends the same text for the
  // Hebrew and English variants (see the cross-field check below).
  EngName: nonEmptyString('EngName', 'a security name').max(30, {
    error: issue => `EngName: expected at most 30 characters, got ${describeInput(issue.input)}.`,
  }),
  HebName: nonEmptyString('HebName', 'a security name').max(30, {
    error: issue => `HebName: expected at most 30 characters, got ${describeInput(issue.input)}.`,
  }),
  EngNameFull: nonEmptyString('EngNameFull', 'a security name').max(30, {
    error: issue =>
      `EngNameFull: expected at most 30 characters, got ${describeInput(issue.input)}.`,
  }),
  HebNameFull: nonEmptyString('HebNameFull', 'a security name').max(30, {
    error: issue =>
      `HebNameFull: expected at most 30 characters, got ${describeInput(issue.input)}.`,
  }),
  SecurityGroup: poalimEnum('SecurityGroup', SECURITY_GROUPS, 'SECURITY_GROUPS'),
  SecuritySubGroup: alwaysNull('SecuritySubGroup'),
  IssueCurrency: poalimEnum('IssueCurrency', CURRENCIES, 'CURRENCIES'),
  // Country and exchange names are open-ended (one per market the portfolio
  // reaches), so they are shape-checked rather than enumerated.
  IssuerCountry: nonEmptyString('IssuerCountry', 'a country name in Hebrew'),
  IssuerCountryCode: nonEmptyString('IssuerCountryCode', 'an ISO 3166-1 alpha-2 code').regex(
    /^[A-Z]{2}$/,
    {
      error: issue =>
        `IssuerCountryCode: expected two upper-case letters, got ${describeInput(issue.input)}.`,
    },
  ),
  IssuerExchange: nonEmptyString('IssuerExchange', 'an exchange name'),
  ExchangeCountry: nonEmptyString('ExchangeCountry', 'a country name in Hebrew'),
  IsTradable: poalimEnum('IsTradable', TRADABILITY, 'TRADABILITY'),
  IsUSEquity: poalimEnum('IsUSEquity', HEBREW_YES_NO, 'HEBREW_YES_NO'),
  IsJumbo: z.boolean({
    error: issue => `IsJumbo: expected a boolean, got ${describeInput(issue.input)}.`,
  }),
  /** Units of the underlying per contract; 1 for everything but derivatives. */
  ImpliedAssetMult: poalimNumber('ImpliedAssetMult').positive({
    error: issue =>
      `ImpliedAssetMult: expected a positive multiplier, got ${describeInput(issue.input)}.`,
  }),
  ExpiryDate: alwaysNull('ExpiryDate'),

  // ── values, commissions and taxes ───────────────────────────────────────────
  TradeCurrency: poalimEnum('TradeCurrency', CURRENCIES, 'CURRENCIES'),
  SettlementCurrency: poalimEnum('SettlementCurrency', CURRENCIES, 'CURRENCIES'),
  CommissionsCurrency: poalimEnum('CommissionsCurrency', CURRENCIES, 'CURRENCIES'),
  PaymentCurrency: alwaysNull('PaymentCurrency'),
  TradeGrossValueTradeCurrency: nonNegativeNumber('TradeGrossValueTradeCurrency'),
  TradeGrossValueNIS: nonNegativeNumber('TradeGrossValueNIS'),
  /** Signed — the net cash effect of the execution. */
  NetValueNIS: poalimNumber('NetValueNIS'),
  NetValueSettlementCurrency: poalimNumber('NetValueSettlementCurrency'),
  SettlementPrice: nonNegativeNumber('SettlementPrice'),
  TradeCommissionPercent: percentNumber('TradeCommissionPercent'),
  // Commission values go negative when the bank refunds one.
  TradeCommissionValueNIS: poalimNumber('TradeCommissionValueNIS'),
  TradeCommissionValueTradeCurrency: poalimNumber('TradeCommissionValueTradeCurrency'),
  AgentCommissionValueTradeCurrency: nonNegativeNumber('AgentCommissionValueTradeCurrency'),
  ManagementFeesPercent: percentNumber('ManagementFeesPercent'),
  ManagementFeesValueNIS: nonNegativeNumber('ManagementFeesValueNIS'),
  ManagementFeesValueTradeCurrency: nonNegativeNumber('ManagementFeesValueTradeCurrency'),
  // Tax values are signed: a refund of previously withheld tax is negative.
  IsraeTaxValue: poalimNumber('IsraeTaxValue'),
  IsraelTaxPercent: percentNumber('IsraelTaxPercent'),
  IsraelTaxValueByPaymentsSettlementCurrency: poalimNumber(
    'IsraelTaxValueByPaymentsSettlementCurrency',
  ),
  ForeignTaxPercent: percentNumber('ForeignTaxPercent'),
  ForeignTaxValueSettlementCurrency: poalimNumber('ForeignTaxValueSettlementCurrency'),
  CapitalTaxPercent: percentNumber('CapitalTaxPercent'),
  CapitalTaxValueSettlementCurrency: poalimNumber('CapitalTaxValueSettlementCurrency'),
  PostDeductionTaxValueNIS: nonNegativeNumber('PostDeductionTaxValueNIS'),
  PreviousActionsDeductions: poalimNumber('PreviousActionsDeductions'),
  PostActionDeductionBalance: nonNegativeNumber('PostActionDeductionBalance'),
  NominalProfitLossNIS: poalimNumber('NominalProfitLossNIS'),
  NominalProfitLossLinkage: poalimNumber('NominalProfitLossLinkage'),
  RealProfitLossNIS: poalimNumber('RealProfitLossNIS'),
  AccumulatedInterest: nonNegativeNumber('AccumulatedInterest'),
  FundPlusAccumulatedInerestValue: nonNegativeNumber('FundPlusAccumulatedInerestValue'),
  /** Payment per unit held, not a percentage despite the name. */
  PeymentPecentage: nonNegativeNumber('PeymentPecentage'),
  PaymentLinkingValue: nonNegativeNumber('PaymentLinkingValue'),
  ExDateBalance: nonNegativeNumber('ExDateBalance'),
  IssueCurrencyToTradeCurrencyRate: nonNegativeNumber('IssueCurrencyToTradeCurrencyRate'),
  TradeCurrnecyRate: nonNegativeNumber('TradeCurrnecyRate'),
  /**
   * The customer's own rate, or the sentinel -1 when the bank has none. Any
   * other negative value would be a real rate with the wrong sign.
   */
  PersonalCurrencyRate: poalimNumber('PersonalCurrencyRate').refine(
    value => value === -1 || value > 0,
    {
      error: issue =>
        `PersonalCurrencyRate: expected a positive rate or the sentinel -1, got ${describeInput(issue.input)}.`,
    },
  ),

  // ── order / execution metadata ──────────────────────────────────────────────
  PaymentName: alwaysNull('PaymentName'),
  /** Set only for orders routed from an external trading system. */
  OrderOrigin: nonEmptyString('OrderOrigin', 'an order origin').nullable(),
  OrderType: alwaysNull('OrderType'),
  OrderSubject: alwaysNull('OrderSubject'),
  // The order-side fields are zero throughout this feed: it reports executions,
  // and the originating order lives in a different endpoint.
  OrderedNV: nonNegativeNumber('OrderedNV'),
  ExecutedNV: nonNegativeNumber('ExecutedNV'),
  OrderedValue: nonNegativeNumber('OrderedValue'),
  ExecutionDate: poalimDateTime('ExecutionDate'),
  LastTranactionDate: poalimDateTime('LastTranactionDate').nullable(),
  IsCancelTransaction: poalimEnum('IsCancelTransaction', HEBREW_YES_NO, 'HEBREW_YES_NO'),
});

/**
 * Invariants the bank's own data obeys across fields. They are what makes a
 * half-understood response fail loudly instead of landing in the database as a
 * plausible-looking row.
 */
const PoalimSecurityTransactionSchema = PoalimSecurityTransactionFields.superRefine((row, ctx) => {
  // A buy/sell names its own trade type, in both directions: the pair decides
  // whether a row moves a position, so a mismatch would misread the trade.
  //
  // Nothing stronger is asserted about the other categories. The bank files the
  // same transfer TradeType under `תשלומים ואירועי חברה` on one account and under
  // `העברות` on another, so which non-trading bucket a TradeType belongs to is
  // the bank's presentation choice, not an invariant.
  const isTradingTransaction = TRADING_TRADE_TYPES.has(row.TransactionType);
  const isTradingTrade = TRADING_TRADE_TYPES.has(row.TradeType);
  if (isTradingTransaction !== isTradingTrade) {
    ctx.addIssue({
      code: 'custom',
      path: ['TradeType'],
      message: `TradeType "${row.TradeType}" and TransactionType "${row.TransactionType}" disagree on whether this row is a trade — one names a buy/sell and the other does not.`,
    });
  } else if (isTradingTransaction && row.TradeType !== row.TransactionType) {
    ctx.addIssue({
      code: 'custom',
      path: ['TradeType'],
      message: `TradeType "${row.TradeType}" contradicts TransactionType "${row.TransactionType}" — a buy cannot be a sale.`,
    });
  }

  // The payment block travels together — all three set, or all three null. A
  // half-filled block would silently break the ingestion dedup key, which is
  // built from exactly these fields. Which categories carry one is left open:
  // corporate actions always do and trades never do, but transfers vary.
  const paymentFields = ['PaymentType', 'PaymentDate', 'ExDate'] as const;
  const setPaymentFields = paymentFields.filter(field => row[field] !== null);
  if (setPaymentFields.length > 0 && setPaymentFields.length < paymentFields.length) {
    for (const field of paymentFields) {
      if (row[field] === null) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} is null while ${setPaymentFields.join(' and ')} ${setPaymentFields.length === 1 ? 'is' : 'are'} set — the bank fills PaymentType, PaymentDate and ExDate together.`,
        });
      }
    }
  }
  if (isTradingTrade && setPaymentFields.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['PaymentType'],
      message: `${setPaymentFields.join(', ')} set on a plain "${row.TradeType}" execution, where the bank leaves the payment fields null.`,
    });
  }

  // A cancelled execution must say when it was cancelled (the reverse does not
  // hold: a cancellation date also appears on the rows that supersede one).
  if (row.IsCancelTransaction === 'כן' && row.CancelDate === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['CancelDate'],
      message: 'CancelDate is null although IsCancelTransaction is "כן" (cancelled).',
    });
  }

  // The account is addressed as branch-account; the string copies must agree
  // with the numeric ones, or the ingested row would point at another account.
  if (row.FinancialAccountBranch !== null && Number(row.FinancialAccountBranch) !== row.Branch) {
    ctx.addIssue({
      code: 'custom',
      path: ['FinancialAccountBranch'],
      message: `FinancialAccountBranch "${row.FinancialAccountBranch}" does not match Branch ${row.Branch}.`,
    });
  }
  if (row.FinancialAccountNumber !== null && Number(row.FinancialAccountNumber) !== row.Account) {
    ctx.addIssue({
      code: 'custom',
      path: ['FinancialAccountNumber'],
      message: `FinancialAccountNumber "${row.FinancialAccountNumber}" does not match Account ${row.Account}.`,
    });
  }

  // One currency per execution: the bank quotes, settles and issues in the same
  // one, and the ingested amounts are only comparable while that holds.
  if (row.TradeCurrency !== row.SettlementCurrency) {
    ctx.addIssue({
      code: 'custom',
      path: ['SettlementCurrency'],
      message: `SettlementCurrency "${row.SettlementCurrency}" differs from TradeCurrency "${row.TradeCurrency}" — a cross-currency settlement needs an explicit conversion in the ingestion pipe.`,
    });
  }
  if (row.IssueCurrency !== row.TradeCurrency) {
    ctx.addIssue({
      code: 'custom',
      path: ['IssueCurrency'],
      message: `IssueCurrency "${row.IssueCurrency}" differs from TradeCurrency "${row.TradeCurrency}" — IssueCurrencyToTradeCurrencyRate would have to be applied.`,
    });
  }

  // Both name fields carry the same text; if they ever diverge the ingestion
  // pipe is storing one language in two columns and losing the other.
  if (row.EngName !== row.HebName) {
    ctx.addIssue({
      code: 'custom',
      path: ['HebName'],
      message: `HebName "${row.HebName}" differs from EngName "${row.EngName}" — the bank has started sending genuinely localised names.`,
    });
  }

  if ((row.IsUSEquity === 'כן') !== (row.IssuerCountryCode === 'US')) {
    ctx.addIssue({
      code: 'custom',
      path: ['IsUSEquity'],
      message: `IsUSEquity "${row.IsUSEquity}" disagrees with IssuerCountryCode "${row.IssuerCountryCode}".`,
    });
  }
});

/**
 * Only `Account` is modelled. `PageState` is the bank's opaque paging cursor —
 * it is carried through untouched (and unused: the endpoint is queried with an
 * explicit date range rather than paged).
 */
export const HapoalimSecuritiesTransactionsSchema = z.strictObject({
  Account: z.strictObject({
    PageState: z
      .string({
        error: issue => `Account.PageState: expected a string, got ${describeInput(issue.input)}.`,
      })
      .nullable()
      .optional(),
    // Omitted entirely for a portfolio with no activity in the requested range —
    // that is an empty result, not a malformed response, so normalise it to [].
    Execution: z
      .array(PoalimSecurityTransactionSchema, {
        error: issue => `Account.Execution: expected a list, got ${describeInput(issue.input)}.`,
      })
      .default([]),
  }),
});

export type HapoalimSecuritiesTransactions = z.infer<typeof HapoalimSecuritiesTransactionsSchema>;
export type PoalimSecurityTransaction = z.infer<typeof PoalimSecurityTransactionSchema>;

/**
 * Turns a failed parse into something a human can act on.
 *
 * The raw issue list points at `Account.Execution.37.TradeType`, which says
 * nothing about *which* execution row that is. This walks back into the parsed
 * input to name the security and trade date alongside each issue.
 *
 * Issues are grouped by field and message before the list is truncated: one
 * bank-side change hits every affected row, so printing the first N raw issues
 * used to spend the whole budget on one repeated complaint and hide the rest
 * behind "…and 33 more". Grouping keeps every *distinct* problem visible, with
 * a representative row and an occurrence count.
 */
export function describeSecuritiesTransactionsError(
  input: unknown,
  error: z.ZodError,
  maxIssues = 10,
): string {
  const executions = (input as { Account?: { Execution?: unknown[] } } | null)?.Account?.Execution;

  const groups = new Map<string, { line: string; count: number }>();

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    const [root, list, indexKey] = issue.path;
    let context = '';
    // The row index is what differs between repeats of the same problem, so the
    // field path is stripped of it for grouping and the row named in the text.
    let groupPath = path;
    if (root === 'Account' && list === 'Execution' && typeof indexKey === 'number') {
      groupPath = ['Account', 'Execution', '*', ...issue.path.slice(3)].join('.');
      const row = executions?.[indexKey] as Record<string, unknown> | undefined;
      if (row) {
        context = ` [security ${String(row['Security'] ?? '?')}, traded ${String(
          row['TradeDate'] ?? '?',
        ).slice(0, 10)}]`;
      }
    }
    // The field-level messages name their own field; the path already does, so
    // drop the duplicate prefix rather than printing "…TradeType: TradeType: …".
    const field = issue.path.at(-1);
    const message =
      typeof field === 'string' && issue.message.startsWith(`${field}: `)
        ? issue.message.slice(field.length + 2)
        : issue.message;

    const key = `${groupPath} ${message}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { line: `${path || '(root)'}: ${message}${context}`, count: 1 });
    }
  }

  const grouped = [...groups.values()];
  const shown = grouped.slice(0, maxIssues);
  const omitted = grouped.length - shown.length;
  const summary =
    `Poalim securities transactions did not match the expected response shape ` +
    `(${error.issues.length} issue${error.issues.length === 1 ? '' : 's'}${
      grouped.length === error.issues.length ? '' : ` of ${grouped.length} distinct kinds`
    }${
      executions
        ? ` across ${executions.length} execution${executions.length === 1 ? '' : 's'}`
        : ''
    }).`;

  return [
    summary,
    ...shown.map(({ line, count }) => `  - ${line}${count > 1 ? ` (×${count})` : ''}`),
  ]
    .concat(
      omitted > 0 ? [`  …and ${omitted} more distinct issue${omitted === 1 ? '' : 's'}.`] : [],
    )
    .join('\n');
}
