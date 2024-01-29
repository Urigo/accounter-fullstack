import { Application, testkit } from 'graphql-modules';
import 'reflect-metadata';
import { beforeAll, describe, it } from 'vitest';
import { fetchChargeQuery, fetchChargesQuery, getDummyApp } from './ledger-test-data';

let app: Application;

describe.concurrent('Ledger Generation', () => {
  beforeAll(async () => {
    app = getDummyApp();
  });

  describe.concurrent('Local currency (ILS)', () => {
    it('should generate ledger records for basic ILS charge', async ({ expect }) => {
      const result = await testkit.execute(app, {
        document: fetchChargeQuery,
        variableValues: {
          id: '1000',
        },
      });

      expect(result.data?.charge?.ledgerRecords.message).toBeUndefined();

      expect(result.data?.charge?.ledgerRecords?.records?.length).toBe(2);

      expect(result.data?.charge?.ledgerRecords).toMatchSnapshot();
    });

    it('dates diff should have no effect', async ({ expect }) => {
      const result = await testkit.execute(app, {
        document: fetchChargeQuery,
        variableValues: {
          id: '1001',
        },
      });

      expect(result.data?.charge?.ledgerRecords.message).toBeUndefined();

      expect(result.data?.charge?.ledgerRecords?.records?.length).toBe(2);

      expect(result.data?.charge?.ledgerRecords).toMatchSnapshot();
    });

    it('Should handle no-invoice businesses', async ({ expect }) => {
      const result = await testkit.execute(app, {
        document: fetchChargeQuery,
        variableValues: {
          id: '1002',
        },
      });

      expect(result.data?.charge?.ledgerRecords.message).toBeUndefined();

      expect(result.data?.charge?.ledgerRecords?.records?.length).toBe(1);

      expect(result.data?.charge?.ledgerRecords).toMatchSnapshot();
    });
  });

  describe.concurrent('Foreign currency', () => {
    it('should generate ledger records for basic USD charge', async ({ expect }) => {
      const result = await testkit.execute(app, {
        document: fetchChargeQuery,
        variableValues: {
          id: '1100',
        },
      });
      expect(result.data?.charge?.ledgerRecords.message).toBeUndefined();
      expect(result.data?.charge?.ledgerRecords?.records?.length).toBe(2);
      expect(result.data?.charge?.ledgerRecords).toMatchSnapshot();
    });

    it('should generate ledger records including conversion diff ledger for USD charge with dates diff', async ({
      expect,
    }) => {
      const result = await testkit.execute(app, {
        document: fetchChargeQuery,
        variableValues: {
          id: '1101',
        },
      });
      expect(result.data?.charge?.ledgerRecords.message).toBeUndefined();
      expect(result.data?.charge?.ledgerRecords?.records?.length).toBe(3);
      expect(result.data?.charge?.ledgerRecords).toMatchSnapshot();
      const exchangeLedger = result.data?.charge?.ledgerRecords?.records?.[2];
      expect(exchangeLedger?.description).toBe('Exchange ledger record');
    });

    it('Conversion diff ledger should be generated based on transaction debit_date', async ({
      expect,
    }) => {
      const result = await testkit.execute(app, {
        document: fetchChargesQuery,
        variableValues: {
          IDs: ['1102', '1103'],
        },
      });
      expect(result.data?.chargesById?.length).toBe(2);

      // charge 1102: only debit_daet diff
      const chargeDebitDateDiff = result.data?.chargesById?.[0];
      expect(chargeDebitDateDiff?.ledgerRecords?.records?.length).toBe(3);

      // charge 1103: only event_date diff
      const chargeEventDateDiff = result.data?.chargesById?.[1];
      expect(chargeEventDateDiff?.ledgerRecords?.records?.length).toBe(2);
    });

    it('Conversion diff ledger should should have opposite sides based on what payment/doc chronological order', async ({
      expect,
    }) => {
      const result = await testkit.execute(app, {
        document: fetchChargesQuery,
        variableValues: {
          IDs: ['1101', '1104'],
        },
      });
      expect(result.data?.chargesById?.length).toBe(2);

      // charge 1101: doc first
      const chargeDocFirst = result.data?.chargesById?.[0];
      expect(chargeDocFirst?.ledgerRecords?.records?.length).toBe(3);
      const exchangeLedger1 = chargeDocFirst?.ledgerRecords?.records?.[2];
      expect(exchangeLedger1?.debitAccount1?.id).toBe('900');

      // charge 1104: transaction first
      const chargeTransactionFirst = result.data?.chargesById?.[1];
      expect(chargeTransactionFirst?.ledgerRecords?.records?.length).toBe(3);
      const exchangeLedger2 = chargeDocFirst?.ledgerRecords?.records?.[2];
      expect(exchangeLedger2?.creditAccount1?.id).toBe('2003');
    });

    it('Should handle no-invoice businesses', async ({ expect }) => {
      const result = await testkit.execute(app, {
        document: fetchChargeQuery,
        variableValues: {
          id: '1105',
        },
      });

      expect(result.data?.charge?.ledgerRecords.message).toBeUndefined();

      expect(result.data?.charge?.ledgerRecords?.records?.length).toBe(1);

      expect(result.data?.charge?.ledgerRecords).toMatchSnapshot();
    });
  });

  describe.concurrent('Conversion', () => {
    it('should generate ledger records for basic conversion charge', async ({ expect }) => {
      const result = await testkit.execute(app, {
        document: fetchChargeQuery,
        variableValues: {
          id: '1200',
        },
      });
      expect(result.data?.charge?.ledgerRecords.message).toBeUndefined();
      expect(result.data?.charge?.ledgerRecords?.records?.length).toBe(2);
      expect(result.data?.charge?.ledgerRecords).toMatchSnapshot();
    });

    it('Unbalances charge should throw', async ({ expect }) => {
      const result = await testkit.execute(app, {
        document: fetchChargeQuery,
        variableValues: {
          id: '1201',
        },
      });
      expect(result.data?.charge?.ledgerRecords.message).toContain(
        'Conversion charges must have a ledger balance',
      );
    });

    it('should generate ledger records for conversion charge with dates diff', async ({
      expect,
    }) => {
      const result = await testkit.execute(app, {
        document: fetchChargeQuery,
        variableValues: {
          id: '1202',
        },
      });
      expect(result.data?.charge?.ledgerRecords.message).toBeUndefined();
      expect(result.data?.charge?.ledgerRecords?.records?.length).toBe(2);
      expect(result.data?.charge?.ledgerRecords).toMatchSnapshot();
    });
  });

  describe.concurrent('Misc', () => {
    it('should handle currency AND date diff', async ({ expect }) => {
      // the odd case of Lance's charge
      const result = await testkit.execute(app, {
        document: fetchChargeQuery,
        variableValues: {
          id: '1900',
        },
      });
      expect(result.data?.charge?.ledgerRecords.message).toBeUndefined();
      expect(result.data?.charge?.ledgerRecords?.records?.length).toBe(3);
      expect(result.data?.charge?.ledgerRecords).toMatchSnapshot();
    });
  });
});
