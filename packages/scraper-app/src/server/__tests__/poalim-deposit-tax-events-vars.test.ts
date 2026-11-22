import { describe, expect, it } from 'vitest';
import type { UploadPoalimDepositTaxEventsMutationVariables } from '../gql/index.js';
import { poalimDepositTaxEventsVars } from '../graphql/mutations.js';
import type { PoalimDepositsTaxEventsPayload } from '../payload-schemas/poalim-deposits-tax-events.schema.js';
import { validatePayload } from '../validate-payload.js';

const bankAccount = { bankNumber: 12, branchNumber: 615, accountNumber: 100000 };

/** Codegen types a list input as `T | T[]`; normalise so tests can index it. */
function rows(vars: UploadPoalimDepositTaxEventsMutationVariables) {
  return [vars.events].flat();
}

// Synthetic fixtures only — never lifted from a real bank capture.
const capitalized = {
  eventSerialNumber: 1,
  executingDate: 20250102,
  formattedExecutingDate: '2025-01-02T00:00:00.000Z',
  actionTypeDescription: 'תשלום ריבית ל',
  shortProductName: 'פר"י',
  taxActionTypeDescription: 'תשלום',
  taxEventAmount: 3.21,
  debitCurrencyShortedDescription: 'ש"ח',
  debitAmount: 0.5,
  crditAmount: 0,
  additionalInformationExistenceSwitch: 1,
};

describe('poalimDepositTaxEventsVars', () => {
  it('stamps the requested account and converts the yyyymmdd date', () => {
    const payload: PoalimDepositsTaxEventsPayload = {
      savingsAndCurrentProductsTaxEvents: [capitalized],
    };
    const [row] = rows(poalimDepositTaxEventsVars(payload, bankAccount));
    expect(row).toMatchObject({
      ...bankAccount,
      eventSerialNumber: 1,
      executingDate: '2025-01-02',
      actionTypeDescription: 'תשלום ריבית ל',
      taxEventAmount: 3.21,
      debitAmount: 0.5,
      crditAmount: 0,
    });
  });

  it('maps an empty report to no rows', () => {
    expect(
      rows(poalimDepositTaxEventsVars({ savingsAndCurrentProductsTaxEvents: [] }, bankAccount)),
    ).toEqual([]);
  });
});

describe("validatePayload('poalim-deposits-tax-events')", () => {
  it('accepts the report and keeps the info messages out of the way', () => {
    const payload = validatePayload('poalim-deposits-tax-events', {
      savingsAndCurrentProductsTaxEvents: [capitalized],
      messages: [{ messageCode: 5, messageDescription: 'לידיעה בלבד', messageTypeCode: 'I' }],
    });
    expect(payload.savingsAndCurrentProductsTaxEvents).toHaveLength(1);
  });

  it('rejects a row missing a field the upload reads', () => {
    const { taxEventAmount: _omit, ...broken } = capitalized;
    expect(() =>
      validatePayload('poalim-deposits-tax-events', {
        savingsAndCurrentProductsTaxEvents: [broken],
      }),
    ).toThrow(/taxEventAmount/);
  });
});
