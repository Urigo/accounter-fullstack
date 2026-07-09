import { describe, expect, it } from 'vitest';
import type { BusinessMatchData, OwnerMatchInfo } from './business-matcher.helper.js';
import { applyForeignCounterpartyVatDefault } from './business-matcher.helper.js';

const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const LOCAL_BIZ_ID = '00000000-0000-0000-0000-000000000002';
const FOREIGN_BIZ_ID = '00000000-0000-0000-0000-000000000003';
const NO_LOCALITY_BIZ_ID = '00000000-0000-0000-0000-000000000004';

const owner: OwnerMatchInfo = { id: OWNER_ID, locality: 'Israel' };

function business(id: string, locality: string | null): BusinessMatchData {
  return {
    id,
    name: `business-${id}`,
    hebrew_name: null,
    vat_number: null,
    suggestion_data: null,
    locality,
  };
}

const businesses: BusinessMatchData[] = [
  business(OWNER_ID, 'Israel'),
  business(LOCAL_BIZ_ID, 'Israel'),
  business(FOREIGN_BIZ_ID, 'United States'),
  business(NO_LOCALITY_BIZ_ID, null),
];

describe('applyForeignCounterpartyVatDefault', () => {
  it('keeps an extracted VAT amount untouched, even for a foreign counterparty', () => {
    expect(
      applyForeignCounterpartyVatDefault(17, owner, OWNER_ID, FOREIGN_BIZ_ID, businesses),
    ).toBe(17);
  });

  it('keeps an extracted VAT amount of 0 untouched', () => {
    expect(applyForeignCounterpartyVatDefault(0, owner, OWNER_ID, FOREIGN_BIZ_ID, businesses)).toBe(
      0,
    );
  });

  it('sets VAT to 0 when the recipient counterparty is foreign', () => {
    expect(
      applyForeignCounterpartyVatDefault(null, owner, OWNER_ID, FOREIGN_BIZ_ID, businesses),
    ).toBe(0);
  });

  it('sets VAT to 0 when the issuer counterparty is foreign', () => {
    expect(
      applyForeignCounterpartyVatDefault(null, owner, FOREIGN_BIZ_ID, OWNER_ID, businesses),
    ).toBe(0);
  });

  it('sets VAT to 0 when only a foreign non-owner side matched', () => {
    expect(applyForeignCounterpartyVatDefault(null, owner, FOREIGN_BIZ_ID, null, businesses)).toBe(
      0,
    );
    expect(applyForeignCounterpartyVatDefault(null, owner, null, FOREIGN_BIZ_ID, businesses)).toBe(
      0,
    );
  });

  it('keeps NULL when the counterparty shares the owner locality', () => {
    expect(
      applyForeignCounterpartyVatDefault(null, owner, LOCAL_BIZ_ID, OWNER_ID, businesses),
    ).toBeNull();
  });

  it('keeps NULL when the counterparty has no locality', () => {
    expect(
      applyForeignCounterpartyVatDefault(null, owner, NO_LOCALITY_BIZ_ID, OWNER_ID, businesses),
    ).toBeNull();
  });

  it('keeps NULL when no side matched', () => {
    expect(applyForeignCounterpartyVatDefault(null, owner, null, null, businesses)).toBeNull();
  });

  it('keeps NULL when the only match is the owner itself', () => {
    expect(applyForeignCounterpartyVatDefault(null, owner, OWNER_ID, null, businesses)).toBeNull();
    expect(
      applyForeignCounterpartyVatDefault(null, owner, OWNER_ID, OWNER_ID, businesses),
    ).toBeNull();
  });

  it('keeps NULL when both sides matched non-owner businesses (ambiguous counterparty)', () => {
    expect(
      applyForeignCounterpartyVatDefault(null, owner, LOCAL_BIZ_ID, FOREIGN_BIZ_ID, businesses),
    ).toBeNull();
  });

  it('keeps NULL when the counterparty is unknown to the businesses list', () => {
    expect(
      applyForeignCounterpartyVatDefault(
        null,
        owner,
        OWNER_ID,
        '00000000-0000-0000-0000-00000000dead',
        businesses,
      ),
    ).toBeNull();
  });

  it('keeps NULL when owner info is missing or has no locality', () => {
    expect(
      applyForeignCounterpartyVatDefault(null, undefined, OWNER_ID, FOREIGN_BIZ_ID, businesses),
    ).toBeNull();
    expect(
      applyForeignCounterpartyVatDefault(
        null,
        { id: OWNER_ID, locality: null },
        OWNER_ID,
        FOREIGN_BIZ_ID,
        businesses,
      ),
    ).toBeNull();
  });
});
