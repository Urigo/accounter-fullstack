import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
// import type { ChargesTypes } from '@modules/charges';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetHashavshevetBusinessIndexesByNameParams,
  IGetHashavshevetBusinessIndexesByNameQuery,
  IGetHashavshevetBusinessIndexesByOwnerAndBusinessIdQuery,
  IGetHashGovIndexesQuery,
} from '../types.js';

const getHashavshevetBusinessIndexesByName = sql<IGetHashavshevetBusinessIndexesByNameQuery>`
    SELECT *
    FROM accounter_schema.hash_business_indexes
    WHERE business IN (
        SELECT id
        FROM accounter_schema.businesses
        WHERE name = $financialEntityName)
    AND hash_owner = $ownerId LIMIT 1;`;

const getHashGovIndexes = sql<IGetHashGovIndexesQuery>`
    SELECT *
    FROM accounter_schema.hash_gov_indexes
    WHERE hash_owner = $ownerId;`;

const getHashavshevetBusinessIndexesByOwnerAndBusinessID = sql<IGetHashavshevetBusinessIndexesByOwnerAndBusinessIdQuery>`
SELECT *
FROM accounter_schema.hash_business_indexes
WHERE
    hash_owner = $financialEntityId
    AND business IN $$businessIDs;`;

export type VatIndexesKeys =
  | 'vatInputsIndex'
  | 'vatPropertyInputsIndex'
  | 'vatPropertyOutputsIndex'
  | 'vatOutputsIndex'
  | 'vatIncomesMovementTypeIndex'
  | 'vatFreeIncomesMovementTypeIndex'
  | 'vatExpensesMovementTypeIndex'
  | 'vatExpensesPropertyMovementTypeIndex'
  | 'vatIncomesIndex'
  | 'vatFreeIncomesIndex'
  | 'hashCurrencyRatesDifferencesIndex'
  | 'foreignTransferBankFees';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class HashavshevetProvider {
  constructor(
    private dbProvider: DBProvider,
    private financialAccountsProvider: FinancialAccountsProvider,
  ) {}

  public getHashavshevetBusinessIndexesByName(params: IGetHashavshevetBusinessIndexesByNameParams) {
    return getHashavshevetBusinessIndexesByName.run(params, this.dbProvider);
  }

  public async getHashavshevetVatIndexes(ownerId: string) {
    const indexes = await getHashGovIndexes.run({ ownerId }, this.dbProvider);

    const convertKey = (key: string): VatIndexesKeys => {
      switch (key) {
        case 'VAT_inputs':
          return 'vatInputsIndex';
        case 'VAT_Property_Inputs':
          return 'vatPropertyInputsIndex';
        case 'VAT_Property_Outputs':
          return 'vatPropertyOutputsIndex';
        case 'VAT_outputs':
          return 'vatOutputsIndex';
        case 'VAT_Incomes_Movement_Type':
          return 'vatIncomesMovementTypeIndex';
        case 'VAT_Free_Incomes_Movement_Type':
          return 'vatFreeIncomesMovementTypeIndex';
        case 'VAT_Expenses_Movement_Type':
          return 'vatExpensesMovementTypeIndex';
        case 'VAT_Property_Expenses_Movement_Type':
          return 'vatExpensesPropertyMovementTypeIndex';
        case 'VAT_Incomes':
          return 'vatIncomesIndex';
        case 'VAT_Free_Incomes':
          return 'vatFreeIncomesIndex';
        case 'Currency_Rates_Differences':
          return 'hashCurrencyRatesDifferencesIndex';
        case 'Foreign_Transfer_Bank_Fees':
          return 'foreignTransferBankFees';
        default:
          throw new Error(`Unknown Hashavshevet VAT key: "${key}"`);
      }
    };

    const mappedIndexes = indexes.reduce((newObject, index) => {
      if (index.gov_entity && index.hash_index) {
        newObject[convertKey(index.gov_entity)] = index.hash_index;
      }
      return newObject;
    }, {} as Record<VatIndexesKeys, string>);

    return mappedIndexes;
  }

  // public async getHashavshevetIsracardIndex(charge: ChargesTypes.IGetChargesByIdsResult) {
  //   if (
  //     charge.financial_entity_id === '96dba127-90f4-4407-ae89-5a53afa42ca3' &&
  //     charge.bank_reference
  //   ) {
  //     const hashCreditcardIndexResult =
  //       await this.financialAccountsProvider.getFinancialAccountByAccountNumberLoader.load(
  //         charge.bank_reference,
  //       );
  //     console.log('charge.bank_reference', charge.bank_reference);
  //     console.log('hashCreditcardIndexResult', hashCreditcardIndexResult);

  //     // TODO: use ENUM for DB currency_code
  //     switch (charge.currency_code) {
  //       case 'ILS':
  //         return hashCreditcardIndexResult?.hashavshevet_account_ils ?? null;
  //       case 'USD':
  //         return hashCreditcardIndexResult?.hashavshevet_account_usd ?? null;
  //       case 'EUR':
  //         return hashCreditcardIndexResult?.hashavshevet_account_eur ?? null;
  //       default:
  //         throw new Error(`Unknown account type - ${charge.currency_code}`);
  //     }
  //   }
  //   return null;
  // }

  private async batchHashavshevetBusinessIndexesByOwnerAndBusinessID(
    params: readonly { financialEntityId: string; businessID: string }[],
  ) {
    const dict: Record<string, string[]> = {};
    for (const { financialEntityId, businessID } of params) {
      dict[financialEntityId] ||= [];
      if (!dict[financialEntityId].includes(businessID)) {
        dict[financialEntityId].push(businessID);
      }
    }
    const financialEntityIds = Object.keys(dict);
    const res = await Promise.all(
      financialEntityIds.map(id =>
        getHashavshevetBusinessIndexesByOwnerAndBusinessID.run(
          {
            financialEntityId: id,
            businessIDs: dict[id],
          },
          this.dbProvider,
        ),
      ),
    );
    const indexes = res.flat();
    return params.map(({ financialEntityId, businessID }) =>
      indexes.find(
        index => index.hash_owner === financialEntityId && index.business === businessID,
      ),
    );
  }

  public getHashavshevetBusinessIndexesByOwnerAndBusinessIDLoader = new DataLoader(
    (keys: readonly { financialEntityId: string; businessID: string }[]) =>
      this.batchHashavshevetBusinessIndexesByOwnerAndBusinessID(keys),
    { cache: false },
  );
}
