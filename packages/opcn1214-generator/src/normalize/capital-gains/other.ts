/**
 * The header of record 3077 (other transactions, p.55–59) besides the asset members it shares with
 * the asset appendices (assets.ts): up to five improvements written slot by slot, with their count
 * at 245 and their code-50 amounts as the derived codes 501–505, and the replacement asset (SPEC
 * §7.2, §7.3, §7.4). Values go through the layout keys (`improvements[1].date`), never offsets.
 */
import type { Primitive } from '../../codec/types.js';
import type { OtherTransactionsAppendix } from '../../model/input.js';
import { makeIssue, type Issue } from '../../validate/issue.js';

/**
 * Header keys of record 3077 that are scalar members of the appendix, besides `improvements` and
 * `walletAddresses` (137, 139, 245 and 487 are derived).
 */
export const OTHER_TRANSACTIONS_INPUT_KEYS = [
  'expropriation',
  'assetDetails',
  'assetLocation',
  'relatedParty',
  'buyerName',
  'dates.code15',
  'dates.code20',
  'replacementAsset.details',
  'replacementAsset.purchaseDate',
  'replacementAsset.price',
] as const;

/** An improvement of a 3077 appendix (SPEC §7.2). */
type Improvement = NonNullable<OtherTransactionsAppendix['improvements']>[number];

/** The members of an improvement slot that are header fields, in field order. */
export const IMPROVEMENT_HEADER_MEMBERS = [
  'expense',
  'accumulatedDepreciation',
  'date',
] as const satisfies ReadonlyArray<keyof Improvement>;

/** A member of an improvement: a header field of its slot or its code-50 amount. */
export type ImprovementMember = (typeof IMPROVEMENT_HEADER_MEMBERS)[number] | 'code50Amount';

/** The number of improvement slots of record 3077 (247–416; codes 501–505). */
export const IMPROVEMENT_SLOTS = 5;

/** Header key of the derived improvement count, 3077@245 (SPEC §7.4). */
export const IMPROVEMENT_COUNT_KEY = 'improvementCount';

/** The FieldDef key of `member` of the `slot`-th (0-based) improvement: `improvements[1].date`. */
export function improvementKey(
  slot: number,
  member: (typeof IMPROVEMENT_HEADER_MEMBERS)[number],
): string {
  return `improvements[${slot}].${member}`;
}

/** The code holding the code-50 amount of the `slot`-th (0-based) improvement: 501 … 505. */
export function improvementCode(slot: number): string {
  return `50${slot + 1}`;
}

/** Codes 501–505: the digit after `50` is the 1-based improvement slot. */
const IMPROVEMENT_CODE = /^50([1-5])$/;

/** The 0-based improvement slot whose code-50 amount `code` (501 … 505) holds, else undefined. */
export function improvementSlotOfCode(code: string): number | undefined {
  const match = IMPROVEMENT_CODE.exec(code);
  return match ? Number(match[1]) - 1 : undefined;
}

/**
 * The header input values of the improvements of a 3077 appendix, by FieldDef key: every member of
 * every improvement that has a slot (the first five), and the count (3077@245, SPEC §7.4) when
 * there is any improvement.
 */
export function improvementsHeader(
  improvements: readonly Improvement[] | undefined,
): Record<string, Primitive> {
  const values: Record<string, Primitive> = {};
  const given = improvements ?? [];
  if (given.length > 0) {
    values[IMPROVEMENT_COUNT_KEY] = given.length;
  }
  for (const [slot, improvement] of given.slice(0, IMPROVEMENT_SLOTS).entries()) {
    for (const member of IMPROVEMENT_HEADER_MEMBERS) {
      values[improvementKey(slot, member)] = improvement[member];
    }
  }
  return values;
}

/**
 * The derived codes 501–505 of the improvements (SPEC §7.4): the code-50 amount of each slot, every
 * code present (undefined when its slot has none), so that they replace any caller value.
 */
export function improvementCodes(
  improvements: readonly Improvement[] | undefined,
): Record<string, number | undefined> {
  return Object.fromEntries(
    Array.from({ length: IMPROVEMENT_SLOTS }, (_, slot) => [
      improvementCode(slot),
      improvements?.[slot]?.code50Amount,
    ]),
  );
}

/**
 * cg.improvements.max: only five improvements have a slot (3077@247–416), so a sixth one has no
 * field to be reported on; it raises a notice at the first improvement that is not written. The
 * first five are still written.
 */
export function improvementsMaxNotice(
  improvements: readonly Improvement[] | undefined,
  inputIndex: number,
  recordIndex: number,
): Issue[] {
  const count = improvements?.length ?? 0;
  if (count <= IMPROVEMENT_SLOTS) {
    return [];
  }
  return [
    makeIssue('cg.improvements.max', {
      message: `capitalGains[${inputIndex}] has ${count} improvements; record 3077 holds at most ${IMPROVEMENT_SLOTS} (report the excess via 962 with reason 965).`,
      path: `capitalGains[${inputIndex}].improvements[${IMPROVEMENT_SLOTS}]`,
      recordType: '3077',
      recordIndex,
      value: count,
      expected: `at most ${IMPROVEMENT_SLOTS}`,
      specRef: { page: 55 },
    }),
  ];
}

/**
 * The improvements as the parser reads them back from the five slots, where `read` gives the value
 * of a member of a slot (absent: undefined): every slot up to the last one with a value, an empty
 * slot before it as `{}` (so the slots keep their input indices), undefined when no slot has one.
 */
export function readImprovements(
  read: (slot: number, member: ImprovementMember) => Primitive,
): Array<Partial<Record<ImprovementMember, Primitive>>> | undefined {
  const members: readonly ImprovementMember[] = [...IMPROVEMENT_HEADER_MEMBERS, 'code50Amount'];
  const slots = Array.from({ length: IMPROVEMENT_SLOTS }, (_, slot) => {
    const improvement: Partial<Record<ImprovementMember, Primitive>> = {};
    for (const member of members) {
      const value = read(slot, member);
      if (value !== undefined) {
        improvement[member] = value;
      }
    }
    return improvement;
  });
  const used = slots.findLastIndex(improvement => Object.keys(improvement).length > 0);
  return used === -1 ? undefined : slots.slice(0, used + 1);
}
