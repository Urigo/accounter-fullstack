/**
 * Pure computations behind the SHAAM 6111 report (נספח 6111: רווח והפסד, דוח התאמה למס, מאזן).
 *
 * Everything here works on plain numbers so it can be unit-tested without the DI container:
 * `shaam6111.helper.ts` loads the ledger, the financial entities and the tax amounts, and hands
 * them over.
 *
 * Sign convention of the inputs: ledger amounts are netted per financial entity as
 * credit − debit (so income and liabilities are positive, expenses and assets negative). Each
 * 6111 code is then oriented to its natural side, so that every line comes out positive in the
 * normal case, as the form expects.
 */
import {
  BALANCE_SHEET_CODE_NAMES,
  PROFIT_LOSS_CODE_NAMES,
  SECTION_1_1,
  SECTION_1_4,
  SECTION_1_9,
  SECTION_1_10,
  SECTION_1_11,
  SECTION_1_12,
  SECTION_1_14,
  SECTION_1_15,
  SECTION_1_16,
  SECTION_1_21,
  SECTION_1_27,
  SECTION_1_28,
  SECTION_1_30,
  SECTION_1_32,
  SECTION_1_33,
  SECTION_1_36,
  SECTION_1_37,
  SECTION_1_38,
  SECTION_1_39,
  SECTION_1_40,
  SECTION_1_41,
  SECTION_1_43,
  SECTION_1_44,
  SECTION_1_45,
  SECTION_1_46,
  SECTION_1_48,
  SECTION_1_50,
  SECTION_1_51,
  TAX_ADJUSTMENT_CODE_NAMES,
} from '@accounter/shaam6111-generator';

export type Shaam6111Entry = {
  code: number;
  amount: number;
  label: string;
};

type LedgerRecordAmounts = {
  credit_entity1: string | null;
  credit_entity2: string | null;
  debit_entity1: string | null;
  debit_entity2: string | null;
  credit_local_amount1: string | number | null;
  credit_local_amount2: string | number | null;
  debit_local_amount1: string | number | null;
  debit_local_amount2: string | number | null;
};

type CodeAmounts = Map<number, number>;

/* ------------------------------------------------------------------------------------------------
 * Code orientation
 * ---------------------------------------------------------------------------------------------- */

/**
 * P&L lines that sit inside an expense section but carry a credit balance, and are subtracted
 * in the section total: closing inventory (1450, 2095) and fuel excise refunds (2068, 3068, 3568).
 */
const PROFIT_LOSS_CREDIT_CONTRA_CODES: ReadonlySet<number> = new Set([
  1450, 2068, 2095, 3068, 3568,
]);

/** Whether a P&L code is an expense line (debit balance) rather than an income line. */
export function isDebitNaturedProfitLossCode(code: number): boolean {
  if (PROFIT_LOSS_CREDIT_CONTRA_CODES.has(code)) {
    return false;
  }
  return (
    // cost of sales, production, R&D, selling, G&A and financial expenses
    (code >= 1300 && code < 5100) ||
    // other expenses
    (code >= 5300 && code < 5400) ||
    // taxes on income, appropriation of profits (dividends)
    (code >= 5600 && code < 5800)
  );
}

/**
 * Asset-side contra accounts (credit balance, subtracted in their section total): allowance for
 * doubtful accounts (7380), accumulated depreciation and impairment (8110-8160, 8180, 8190).
 */
const BALANCE_SHEET_CREDIT_CONTRA_ASSET_CODES: ReadonlySet<number> = new Set([
  7380, 8110, 8120, 8130, 8140, 8150, 8160, 8180, 8190,
]);

/** Liability-side contra accounts (debit balance): severance pay funds (9720). */
const BALANCE_SHEET_DEBIT_CONTRA_LIABILITY_CODES: ReadonlySet<number> = new Set([9720]);

/** Whether a balance sheet code is presented on its debit side (assets) rather than credit side. */
export function isDebitNaturedBalanceSheetCode(code: number): boolean {
  if (BALANCE_SHEET_CREDIT_CONTRA_ASSET_CODES.has(code)) {
    return false;
  }
  if (BALANCE_SHEET_DEBIT_CONTRA_LIABILITY_CODES.has(code)) {
    return true;
  }
  return code >= 7000 && code < 9000;
}

/* ------------------------------------------------------------------------------------------------
 * Summary codes
 * ---------------------------------------------------------------------------------------------- */

function sumCodes(map: CodeAmounts, codes: readonly number[], exclude?: number): number {
  return codes
    .filter(code => code !== exclude)
    .map(code => map.get(code) ?? 0)
    .reduce((a, b) => a + b, 0);
}

function formula(code: number, add: readonly number[], subtract: readonly number[] = []) {
  return {
    code,
    rule: (map: CodeAmounts) => sumCodes(map, add, code) - sumCodes(map, subtract, code),
  };
}

/** P&L summary codes, per spec section 2 (special formulas) and 3.1. */
const PROFIT_LOSS_SUMMARY_RULES = [
  formula(1000, SECTION_1_1),
  formula(
    1300,
    [1306, 1308, 1307, 1310, 1320, 1330, 1340, 1350, 1360, 1371, 1372, 1390, 1400],
    [1450],
  ),
  formula(
    2000,
    [
      2005, 2006, 2011, 2012, 2015, 2020, 2025, 2030, 2035, 2040, 2045, 2050, 2060, 2066, 2067,
      2070, 2075, 2080, 2085, 2090,
    ],
    [2068, 2095],
  ),
  formula(2500, SECTION_1_4),
  formula(
    3000,
    [
      3011, 3013, 3012, 3015, 3020, 3025, 3030, 3040, 3045, 3050, 3060, 3066, 3067, 3070, 3075,
      3080, 3085, 3090, 3100, 3120, 3190,
    ],
    [3068],
  ),
  formula(
    3500,
    [
      3511, 3513, 3512, 3515, 3520, 3530, 3535, 3540, 3545, 3550, 3560, 3566, 3567, 3570, 3575,
      3580, 3590, 3595, 3600, 3610, 3620, 3625, 3631, 3632, 3640, 3650, 3660, 3665, 3680, 3685,
      3690,
    ],
    [3568],
  ),
  formula(5000, SECTION_1_9),
  formula(5100, SECTION_1_10),
  formula(5200, SECTION_1_11),
  formula(5300, SECTION_1_12),
  formula(5600, SECTION_1_14),
  formula(5700, SECTION_1_15),
  formula(5800, SECTION_1_16),
  // 3.1: 6666 = 1000 - 1300 - 2000 - 2500 - 3000 - 3500 - 5000 + 5100 + 5200 - 5300
  formula(6666, [1000, 5100, 5200], [1300, 2000, 2500, 3000, 3500, 5000, 5300]),
];

/** Balance sheet summary codes. Order matters: totals depend on section subtotals. */
const BALANCE_SHEET_SUMMARY_RULES = [
  formula(7100, SECTION_1_27),
  formula(7200, SECTION_1_28),
  formula(7300, [7310, 7320, 7330, 7350, 7360, 7390], [7380]),
  formula(7400, SECTION_1_30),
  formula(7600, SECTION_1_21),
  formula(7700, SECTION_1_32),
  formula(7800, SECTION_1_33),
  // 3.2
  formula(7000, [7100, 7200, 7300, 7400, 7600, 7700, 7800]),
  formula(
    8000,
    [8010, 8020, 8025, 8030, 8040, 8050, 8060, 8080, 8090, 8095, 8100, 8105, 8170],
    [8110, 8120, 8130, 8140, 8150, 8160, 8180, 8190],
  ),
  formula(8200, SECTION_1_37),
  formula(8300, SECTION_1_38),
  formula(8400, SECTION_1_39),
  formula(8500, SECTION_1_40),
  formula(8600, SECTION_1_41),
  formula(8700, SECTION_1_36),
  // 3.3
  formula(8888, [7000, 8000, 8200, 8300, 8400, 8500, 8600, 8700]),
  formula(9100, SECTION_1_43),
  formula(9200, SECTION_1_44),
  formula(9400, SECTION_1_45),
  formula(9500, SECTION_1_46),
  // 3.4
  formula(9000, [9100, 9200, 9400, 9500]),
  formula(9600, SECTION_1_48),
  formula(9700, [9710, 9790], [9720]),
  formula(9800, SECTION_1_50),
  formula(9900, SECTION_1_51),
  // 3.5
  formula(9999, [9000, 9600, 9700, 9800, 9900]),
];

const TAX_ADJUSTMENT_SUMMARY_RULES = [
  // 2.5: 370 = 110+120-130-135+140+150+160-170-180+181+182+183-184+190-200-300+310-320+330+350+360
  formula(
    370,
    [110, 120, 140, 150, 160, 181, 182, 183, 190, 310, 330, 350, 360],
    [130, 135, 170, 180, 184, 200, 300, 320],
  ),
  // 2.7 (no IFRS / option 1): 400 = 100 + 370
  formula(400, [100, 370]),
  // 2.8: 500 = 400 - 430 - 480 + 490
  formula(500, [400, 490], [430, 480]),
];

export const PROFIT_LOSS_SUMMARY_CODES: ReadonlySet<number> = new Set(
  PROFIT_LOSS_SUMMARY_RULES.map(({ code }) => code),
);
export const BALANCE_SHEET_SUMMARY_CODES: ReadonlySet<number> = new Set(
  BALANCE_SHEET_SUMMARY_RULES.map(({ code }) => code),
);

function applyRules(
  map: CodeAmounts,
  rules: ReadonlyArray<{ code: number; rule: (map: CodeAmounts) => number }>,
) {
  for (const { code, rule } of rules) {
    map.set(code, rule(map));
  }
}

function toEntries(map: CodeAmounts, labels: Record<number, string>): Shaam6111Entry[] {
  return Object.entries(labels)
    .map(([code, label]) => {
      const codeInt = Number.parseInt(code, 10);
      return { code: codeInt, label, amount: map.get(codeInt) ?? 0 };
    })
    .sort((a, b) => a.code - b.code);
}

/* ------------------------------------------------------------------------------------------------
 * Ledger aggregation
 * ---------------------------------------------------------------------------------------------- */

/** Nets ledger records per financial entity, as credit − debit in local currency. */
export function netAmountsByFinancialEntity(
  records: readonly LedgerRecordAmounts[],
): Map<string, number> {
  const net = new Map<string, number>();
  const add = (entityId: string | null, amount: string | number | null, sign: 1 | -1) => {
    if (!entityId) {
      return;
    }
    const value = Number(amount ?? 0);
    if (!Number.isFinite(value) || value === 0) {
      net.set(entityId, net.get(entityId) ?? 0);
      return;
    }
    net.set(entityId, (net.get(entityId) ?? 0) + sign * value);
  };
  for (const record of records) {
    add(record.credit_entity1, record.credit_local_amount1, 1);
    add(record.credit_entity2, record.credit_local_amount2, 1);
    add(record.debit_entity1, record.debit_local_amount1, -1);
    add(record.debit_entity2, record.debit_local_amount2, -1);
  }
  return net;
}

/**
 * Sums entity balances into the leaf codes of a section, each code oriented to its natural side.
 * Entities mapped to a summary code are left out: summary codes are always computed.
 */
function leafAmounts(
  netByEntity: ReadonlyMap<string, number>,
  irsCodeByEntity: ReadonlyMap<string, number>,
  sectionCodes: ReadonlySet<number>,
  summaryCodes: ReadonlySet<number>,
  isDebitNatured: (code: number) => boolean,
): CodeAmounts {
  const raw = new Map<number, number>();
  for (const [entityId, amount] of netByEntity) {
    const code = irsCodeByEntity.get(entityId);
    if (code == null || !sectionCodes.has(code) || summaryCodes.has(code)) {
      continue;
    }
    raw.set(code, (raw.get(code) ?? 0) + (isDebitNatured(code) ? -amount : amount));
  }
  const rounded: CodeAmounts = new Map();
  for (const [code, amount] of raw) {
    // `+ 0` normalizes -0, so a zero line never renders as "-0"
    rounded.set(code, Math.round(amount) + 0);
  }
  return rounded;
}

/**
 * The most a total can differ from the rounded total of its unrounded parts when it is summed from
 * `lineCount` lines that were each rounded to the shekel: half a shekel per line, plus the half
 * shekel of rounding the total itself.
 */
export function roundingTolerance(lineCount: number): number {
  return lineCount / 2 + 0.5;
}

/** How many lines of a section were rounded on their own (non-zero lines that are not totals). */
export function countRoundedLines(
  entries: readonly Shaam6111Entry[],
  section: 'profitAndLoss' | 'balanceSheet',
): number {
  const summaryCodes =
    section === 'profitAndLoss' ? PROFIT_LOSS_SUMMARY_CODES : BALANCE_SHEET_SUMMARY_CODES;
  return entries.filter(entry => entry.amount !== 0 && !summaryCodes.has(entry.code)).length;
}

/**
 * Whether profit before tax per the 6111 lines (6666) differs from the books only by the
 * rounding of its lines, as opposed to a P&L entity that is unmapped or mapped elsewhere.
 */
export function profitAndLossMatchesBooks(
  profitAndLoss: readonly Shaam6111Entry[],
  booksProfitBeforeTax: number,
): boolean {
  const profitAndLossTotal = profitAndLoss.find(entry => entry.code === 6666)?.amount ?? 0;
  return (
    Math.abs(profitAndLossTotal - booksProfitBeforeTax) <=
    roundingTolerance(countRoundedLines(profitAndLoss, 'profitAndLoss'))
  );
}

const PROFIT_LOSS_CODES: ReadonlySet<number> = new Set(
  Object.keys(PROFIT_LOSS_CODE_NAMES).map(Number),
);
const BALANCE_SHEET_CODES: ReadonlySet<number> = new Set(
  Object.keys(BALANCE_SHEET_CODE_NAMES).map(Number),
);

/* ------------------------------------------------------------------------------------------------
 * Report sections
 * ---------------------------------------------------------------------------------------------- */

/** Profit and loss section (חלק א), from entity balances for the period. */
export function buildProfitAndLossEntries(
  netByEntity: ReadonlyMap<string, number>,
  irsCodeByEntity: ReadonlyMap<string, number>,
): Shaam6111Entry[] {
  const map = leafAmounts(
    netByEntity,
    irsCodeByEntity,
    PROFIT_LOSS_CODES,
    PROFIT_LOSS_SUMMARY_CODES,
    isDebitNaturedProfitLossCode,
  );
  applyRules(map, PROFIT_LOSS_SUMMARY_RULES);
  return toEntries(map, PROFIT_LOSS_CODE_NAMES);
}

/**
 * Net profit after tax that belongs in retained earnings, from P&L entries:
 * 6666 (profit before tax) − 5600 (taxes on income) + 5800 (equity-method results)
 * − 5700 (appropriation of profits, i.e. dividends).
 */
export function retainedProfitFromProfitAndLoss(entries: readonly Shaam6111Entry[]): number {
  const get = (code: number) => entries.find(entry => entry.code === code)?.amount ?? 0;
  return get(6666) - get(5600) + get(5800) - get(5700);
}

/**
 * Balance sheet section (חלק ג), from cumulative entity balances up to the end of the tax year.
 *
 * There are no closing entries in the ledger, so the year's profit never reaches an equity
 * account. Retained earnings (9980) are therefore the balance of entities mapped to 9980
 * (opening balances, dividends booked against equity) plus the cumulative retained profit of the
 * P&L.
 *
 * Every line is rounded to the shekel on its own, so with agorot in the books the two sides can
 * differ by a few shekels even when every entity is mapped. A difference that rounding can explain
 * (see `roundingTolerance`) is absorbed in 9980; a larger one is left visible, since it means a
 * balance is missing from one side.
 *
 * @param retainedProfitRoundedLines how many rounded P&L lines `cumulativeRetainedProfit` was
 *   summed from, so their rounding counts toward the tolerance too
 */
export function buildBalanceSheetEntries(
  netByEntity: ReadonlyMap<string, number>,
  irsCodeByEntity: ReadonlyMap<string, number>,
  cumulativeRetainedProfit: number,
  retainedProfitRoundedLines = 0,
): Shaam6111Entry[] {
  const map = leafAmounts(
    netByEntity,
    irsCodeByEntity,
    BALANCE_SHEET_CODES,
    BALANCE_SHEET_SUMMARY_CODES,
    isDebitNaturedBalanceSheetCode,
  );
  map.set(9980, (map.get(9980) ?? 0) + Math.round(cumulativeRetainedProfit));
  applyRules(map, BALANCE_SHEET_SUMMARY_RULES);

  const roundingResidue = (map.get(8888) ?? 0) - (map.get(9999) ?? 0);
  if (roundingResidue !== 0) {
    const roundedLines =
      countRoundedLines(toEntries(map, BALANCE_SHEET_CODE_NAMES), 'balanceSheet') +
      retainedProfitRoundedLines;
    if (Math.abs(roundingResidue) <= roundingTolerance(roundedLines)) {
      map.set(9980, (map.get(9980) ?? 0) + roundingResidue);
      applyRules(map, BALANCE_SHEET_SUMMARY_RULES);
    }
  }
  return toEntries(map, BALANCE_SHEET_CODE_NAMES);
}

export type Shaam6111TaxAdjustmentInputs = {
  /** Accounting profit before tax, per the books. */
  profitBeforeTax: number;
  /**
   * Profit before tax per the 6111 P&L lines (6666), when it differs from the books only by
   * rounding (see `profitAndLossMatchesBooks`). Rule 3.7 requires 100 to equal 6666, so 100 takes
   * it, and the rounding difference joins the other adjustments (190 / 200) so that 400 and 500
   * still match the books. Without it, 100 is the books' profit.
   */
  profitAndLossTotal?: number;
  /** Current-year R&D expense booked in the P&L, as a positive add-back. */
  researchAndDevelopmentAddBack: number;
  /**
   * Section 20A R&D deduction for the year (negative): a third of the last three years' R&D,
   * plus the add-back of R&D that is not deductible at all.
   */
  researchAndDevelopmentForTax: number;
  fines: number;
  untaxableGifts: number;
  businessTripsExcessExpenses: number;
  salaryExcessExpenses: number;
  /** Increase (decrease) in the vacation and recovery-pay provisions. */
  reserves: number;
  /** Non-deductible linkage and financing expenses. */
  nontaxableLinkage: number;
  /** Taxable income at the company's own (possibly preferred) rate. */
  taxableIncome: number;
  /** Whether the company's rate differs from the regular corporate tax rate. */
  hasPreferredTaxRate: boolean;
};

/**
 * Tax adjustment section (חלק ב), in the same amounts the tax report (annual workflow step 13)
 * uses, spread over the form's lines:
 * - 110 הוצאות עודפות: fines, non-deductible gifts, excess travel and salary expenses
 * - 150 עלייה/ירידה בהפרשה לחופשה והבראה: the year's change in those provisions
 * - 190 / 200 הוצאות / הכנסות אחרות לתיאום: the net section 20A R&D timing difference and
 *   non-deductible linkage expenses (an addition goes to 190, a deduction to 200)
 * - 100 = 6666 when that only differs from the books by rounding; the difference joins 190 / 200
 * - 400 = 100 + 370, 500 = 400 − 430 − 480 + 490
 * - 510 הכנסה חייבת במס בשיעור מיוחד: taxable income at the preferred rate, when there is one
 */
export function buildTaxAdjustmentEntries(inputs: Shaam6111TaxAdjustmentInputs): Shaam6111Entry[] {
  let excessExpenses =
    inputs.fines +
    inputs.untaxableGifts +
    inputs.businessTripsExcessExpenses +
    inputs.salaryExcessExpenses;
  let otherAdjustments =
    inputs.researchAndDevelopmentAddBack +
    inputs.researchAndDevelopmentForTax +
    inputs.nontaxableLinkage;
  // 110 can't be negative: a net refund of excess expenses is a deduction like any other
  if (excessExpenses < 0) {
    otherAdjustments += excessExpenses;
    excessExpenses = 0;
  }
  const accountingProfit = inputs.profitAndLossTotal ?? Math.round(inputs.profitBeforeTax);
  // the books' profit is what the tax is computed on: carry the rounding difference along
  otherAdjustments += inputs.profitBeforeTax - accountingProfit;
  const otherAdjustmentsRounded = Math.round(otherAdjustments);

  const map: CodeAmounts = new Map([
    [100, accountingProfit],
    [110, Math.round(excessExpenses)],
    [150, Math.round(inputs.reserves)],
    [190, Math.max(otherAdjustmentsRounded, 0)],
    [200, Math.max(-otherAdjustmentsRounded, 0)],
  ]);
  // 2.6: with no IFRS adjustments, 104 equals 100
  map.set(104, map.get(100)!);
  applyRules(map, TAX_ADJUSTMENT_SUMMARY_RULES);
  map.set(510, inputs.hasPreferredTaxRate ? Math.max(Math.round(inputs.taxableIncome), 0) : 0);

  for (const [code, amount] of map) {
    map.set(code, amount + 0);
  }
  return toEntries(map, TAX_ADJUSTMENT_CODE_NAMES);
}
