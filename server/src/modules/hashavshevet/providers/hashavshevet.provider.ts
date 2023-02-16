import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import type { ChargesTypes } from '@modules/charges';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import pgQuery from '@pgtyped/query';
import '../__generated__/hashavshevet.types.js';
import type {
  IGetHashavshevetBusinessIndexesByIdQuery,
  IGetHashavshevetBusinessIndexesByNameParams,
  IGetHashavshevetBusinessIndexesByNameQuery,
  IGetHashGovIndexesQuery,
} from '../types.js';

const { sql } = pgQuery;

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

const getHashavshevetBusinessIndexesById = sql<IGetHashavshevetBusinessIndexesByIdQuery>`
SELECT hbi.*, b.name as business_name
FROM accounter_schema.hash_business_indexes hbi
LEFT JOIN accounter_schema.businesses b
ON hbi.business = b.id
WHERE
    hbi.hash_owner = $financialEntityId
    AND b.name IN $$businessNames;`;

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

  public async getHashavshevetIsracardIndex(charge: ChargesTypes.IGetChargesByIdsResult) {
    if (charge.financial_entity === 'Isracard' && charge.bank_reference) {
      const hashCreditcardIndexResult =
        await this.financialAccountsProvider.getFinancialAccountByAccountNumberLoader.load(
          charge.bank_reference,
        );
      console.log('charge.bank_reference', charge.bank_reference);
      console.log('hashCreditcardIndexResult', hashCreditcardIndexResult);

      // TODO: use ENUM for DB currency_code
      switch (charge.currency_code) {
        case 'ILS':
          return hashCreditcardIndexResult?.hashavshevet_account_ils ?? null;
        case 'USD':
          return hashCreditcardIndexResult?.hashavshevet_account_usd ?? null;
        case 'EUR':
          return hashCreditcardIndexResult?.hashavshevet_account_eur ?? null;
        default:
          throw new Error(`Unknown account type - ${charge.currency_code}`);
      }
    }
    return null;
  }

  private async batchHashavshevetBusinessIndexesById(
    params: readonly { financialEntityId: string; businessName: string }[],
  ) {
    const dict: Record<string, string[]> = {};
    params.forEach(({ financialEntityId, businessName }) => {
      dict[financialEntityId] ||= [];
      if (!dict[financialEntityId].includes(businessName)) {
        dict[financialEntityId].push(businessName);
      }
    });
    const financialEntityIds = Object.keys(dict);
    const res = await Promise.all(
      financialEntityIds.map(id =>
        getHashavshevetBusinessIndexesById.run(
          {
            financialEntityId: id,
            businessNames: dict[id],
          },
          this.dbProvider,
        ),
      ),
    );
    const indexes = res.flat();
    return params.map(({ financialEntityId, businessName }) =>
      indexes.find(
        index => index.hash_owner === financialEntityId && index.business_name === businessName,
      ),
    );
  }

  public getHashavshevetBusinessIndexesByIdLoader = new DataLoader(
    (keys: readonly { financialEntityId: string; businessName: string }[]) =>
      this.batchHashavshevetBusinessIndexesById(keys),
    { cache: false },
  );
}
