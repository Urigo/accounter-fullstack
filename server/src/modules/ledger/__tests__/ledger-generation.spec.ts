import { gql, testkit } from 'graphql-modules';
import 'reflect-metadata';
import { ledgerModule } from '../index';

test('Should generate correct ledger', () => {
  const app = testkit.testModule(ledgerModule, {
    replaceExtensions: true,
  });

  const result = testkit.execute(app, {
    document: gql`
      {
        chargesByIDs(chargeIDs: [1]) {
          ledgerRecords
        }
      }
    `,
  });

  expect(result).toBeDefined();
});
