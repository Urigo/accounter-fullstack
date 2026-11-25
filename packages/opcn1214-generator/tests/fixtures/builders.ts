/**
 * Input builders for tests. `minimalInput()` is the smallest fileable report: it must stay valid
 * against EVERY rule of SPEC §10 (no errors and no warnings); later steps rely on that, so any
 * change here has to keep it so.
 */
import type { Report1214Input } from '../../src/model/input.js';

/** Overrides for a builder: objects merge recursively, arrays and other values replace. */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, overrides: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(overrides)) {
    return overrides;
  }
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] = deepMerge(base[key], value);
  }
  return merged;
}

/** A valid skeleton report (SPEC §7.2) with `overrides` deep-merged into it. */
export function minimalInput(overrides: DeepPartial<Report1214Input> = {}): Report1214Input {
  const base: Report1214Input = {
    taxYear: 2024,
    company: {
      fileNumber: '514000009',
      registeredName: 'חברה לדוגמה בע"מ',
      mailingAddress: 'רחוב הרצל 1, תל אביב',
      businessAddress: 'רחוב הרצל 1, תל אביב',
      phone: { prefix: '03', number: '1234567' },
    },
    declarations: {
      hasTaxPlanningAction: false,
      hadRelatedPartyTransactions: false,
      controlsBodyOfPersons: false,
      holdsRightsInBodyOfPersons: false,
      appliesAccountingStandards: false,
      directorsReceivedOpinion: false,
      tookReportablePosition: false,
    },
    amounts: { '018': 4, '072': 0, '081': 1000, '094': 0, '263': 1 },
    shareholders: [
      {
        idNumber: '123456782',
        fullName: 'ישראל ישראלי',
        isControllingShareholder: true,
        dividendRightsPercent: 100,
      },
    ],
  };
  return deepMerge(base, overrides) as Report1214Input;
}
