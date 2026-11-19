/**
 * The securities header shared by records 3060 (securities, p.43–45) and 3064 (REIT, p.48–49), and
 * reused by 3065: four yes/no flags, up to four withholding agents and the losses carried forward
 * (SPEC §7.2, §7.3). Values go through the layout keys (`withholders[1].branch`), never offsets, so
 * a type whose fields sit at other positions shares it unchanged.
 */
import type { Primitive } from '../../codec/types.js';
import type { SecuritiesAppendix, Withholder } from '../../model/input.js';

/** The header members shared by the securities types besides `withholders` (their FieldDef keys). */
export const SECURITIES_INPUT_KEYS = [
  'foreignAsset',
  'soldToRelatedParty',
  'boughtFromRelatedParty',
  'gainFromInvestmentFund',
  'lossesCarriedForward',
] as const;

/** The members of a withholder slot, in field order. */
const WITHHOLDER_MEMBERS = ['name', 'branch', 'account'] as const satisfies ReadonlyArray<
  keyof Withholder
>;

/** The number of withholder slots of a securities record (146–313; the schema allows 4). */
const WITHHOLDER_SLOTS = 4;

/** The header of a securities appendix: the members SecuritiesAppendix shares with the others. */
export type SecuritiesHeader = Omit<SecuritiesAppendix, 'symbol' | 'amounts'>;

/** The FieldDef key of `member` of the `slot`-th (0-based) withholder: `withholders[1].branch`. */
export function withholderKey(slot: number, member: keyof Withholder): string {
  return `withholders[${slot}].${member}`;
}

/**
 * The header input values of a securities record of `appendix`, by FieldDef key (the derived
 * symbol and appendix number aside): the shared members and every member of every given
 * withholder (`withholders[i].name` …).
 */
export function securitiesHeader(appendix: SecuritiesHeader): Record<string, Primitive> {
  const values: Record<string, Primitive> = {};
  for (const key of SECURITIES_INPUT_KEYS) {
    values[key] = appendix[key];
  }
  for (const [slot, withholder] of (appendix.withholders ?? []).entries()) {
    for (const member of WITHHOLDER_MEMBERS) {
      values[withholderKey(slot, member)] = withholder[member];
    }
  }
  return values;
}

/**
 * The withholders as the parser reads them back from the four slots, where `read` gives the value
 * of a member of a slot (absent: undefined): every slot up to the last one with a value, an empty
 * slot before it as `{}` (so the slots keep their input indices), undefined when no slot has one.
 */
export function readWithholders(
  read: (slot: number, member: keyof Withholder) => Primitive,
): Withholder[] | undefined {
  const slots = Array.from({ length: WITHHOLDER_SLOTS }, (_, slot) => {
    const withholder: Withholder = {};
    for (const member of WITHHOLDER_MEMBERS) {
      const value = read(slot, member);
      if (value !== undefined) {
        withholder[member] = String(value);
      }
    }
    return withholder;
  });
  const used = slots.findLastIndex(withholder => Object.keys(withholder).length > 0);
  return used === -1 ? undefined : slots.slice(0, used + 1);
}
