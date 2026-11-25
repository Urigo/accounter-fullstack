/**
 * The asset header of records 3027 (shares, p.34–36), 3050 (betterment tax, p.37–38), 3051 (forced
 * virtual-currency transaction, p.39–40) and 3054 (oil partnership, p.41–42), reused by 3077:
 * expropriation and related party (yes/no), asset details, asset location (abroad/israel → 1/2),
 * buyer name, purchase date, the dates of codes 15/20/53 (`dates.code15` …, written DD/MM/YYYY by
 * the date kind) and up to two wallet addresses (SPEC §7.2, §7.3). Values go through the layout
 * keys, never offsets, so types whose fields sit at other positions share these helpers unchanged.
 */
import type { Primitive } from '../../codec/types.js';
import type { CapitalGainsAppendix } from '../../model/input.js';
import { ASSET_LOCATION_CODES, enumCode } from '../enums.js';

/** Header keys of record 3027 that are members of the appendix (137, 139 and 255 are derived). */
export const SHARES_INPUT_KEYS = [
  'expropriation',
  'assetDetails',
  'assetLocation',
  'relatedParty',
  'buyerName',
  'dates.code15',
  'dates.code20',
  'dates.code53',
] as const;

/** Header keys of record 3050 that are members of the appendix (137 and 139 are derived). */
export const BETTERMENT_TAX_INPUT_KEYS = [
  'expropriation',
  'assetDetails',
  'purchaseDate',
  'dates.code15',
] as const;

/**
 * Header keys of record 3051 that are scalar members of the appendix, besides `walletAddresses`
 * (137, 139 and 234 are derived).
 */
export const FORCED_VIRTUAL_CURRENCY_INPUT_KEYS = [
  'assetDetails',
  'assetLocation',
  'relatedParty',
  'buyerName',
  'dates.code15',
] as const;

/** Header keys of record 3054 that are members of the appendix (137 and 139 are derived). */
export const OIL_PARTNERSHIP_INPUT_KEYS = ['assetDetails', 'purchaseDate', 'dates.code15'] as const;

/** The number of wallet-address slots of a record (3051@236 and @386). */
const WALLET_ADDRESS_SLOTS = 2;

/** The FieldDef key of the `slot`-th (0-based) wallet address: `walletAddresses[1]`. */
export function walletAddressKey(slot: number): string {
  return `walletAddresses[${slot}]`;
}

/**
 * The value at the dotted `key` (`dates.code15`) of `appendix`; undefined when a member on the way
 * is absent (an untyped caller may leave out a required `dates`) or the value is not a primitive.
 */
function memberAt(appendix: CapitalGainsAppendix, key: string): Primitive {
  let node: unknown = appendix;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean'
    ? node
    : undefined;
}

/**
 * The header input values of the asset members `keys` of `appendix`, by FieldDef key: each value
 * as given (dates as ISO strings, the date kind writes them DD/MM/YYYY), the asset location as its
 * code (abroad → 1, israel → 2; any other value kept for field.enum).
 */
export function assetHeader(
  appendix: CapitalGainsAppendix,
  keys: readonly string[],
): Record<string, Primitive> {
  const values: Record<string, Primitive> = {};
  for (const key of keys) {
    const value = memberAt(appendix, key);
    values[key] = key === 'assetLocation' ? enumCode(ASSET_LOCATION_CODES, value) : value;
  }
  return values;
}

/** The header input values of the wallet addresses, slot by slot (`walletAddresses[0]` …). */
export function walletAddressesHeader(
  addresses: readonly string[] | undefined,
): Record<string, Primitive> {
  const values: Record<string, Primitive> = {};
  for (const [slot, address] of (addresses ?? []).entries()) {
    values[walletAddressKey(slot)] = address;
  }
  return values;
}

/**
 * The wallet addresses as the parser reads them back from the two slots, where `read` gives the
 * value of a slot (absent: undefined): every slot up to the last one with a value, an empty slot
 * before it as `''` (so the slots keep their input indices), undefined when no slot has one.
 */
export function readWalletAddresses(read: (slot: number) => Primitive): string[] | undefined {
  const slots = Array.from({ length: WALLET_ADDRESS_SLOTS }, (_, slot) => read(slot));
  const used = slots.findLastIndex(value => value !== undefined);
  return used === -1
    ? undefined
    : slots.slice(0, used + 1).map(value => (value === undefined ? '' : String(value)));
}
