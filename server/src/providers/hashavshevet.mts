import pgQuery from '@pgtyped/query';
import { IGetChargesByIdsResult } from '../__generated__/charges.types.mjs';
import { IGetHashavshevetBusinessIndexesQuery, IGetHashGovIndexesQuery } from '../__generated__/hashavshevet.types.mjs';
import { pool } from '../providers/db.mjs';
import { getFinancialAccountByAccountNumberLoader } from './financial-accounts.mjs';

const { sql } = pgQuery;

export const getHashavshevetBusinessIndexes = sql<IGetHashavshevetBusinessIndexesQuery>`
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
  | 'hashCurrencyRatesDifferencesIndex';

export async function getHashavshevetVatIndexes(ownerId: string) {
  const indexes = await getHashGovIndexes.run({ ownerId }, pool);

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

export async function getHashavshevetIsracardIndex(charge: IGetChargesByIdsResult) {
  if (charge.financial_entity === 'Isracard' && charge.bank_reference) {
    const hashCreditcardIndexResult = await getFinancialAccountByAccountNumberLoader.load(
      parseInt(charge.bank_reference)
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
