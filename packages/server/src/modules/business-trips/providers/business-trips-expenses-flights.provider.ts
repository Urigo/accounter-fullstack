import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IDeleteBusinessTripFlightsExpenseParams,
  IDeleteBusinessTripFlightsExpenseQuery,
  IGetBusinessTripsFlightsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsFlightsExpensesByIdsQuery,
  IInsertBusinessTripFlightsExpenseParams,
  IInsertBusinessTripFlightsExpenseQuery,
  IUpdateBusinessTripFlightsExpenseParams,
  IUpdateBusinessTripFlightsExpenseQuery,
} from '../types.js';

const getBusinessTripsFlightsExpensesByBusinessTripIds = sql<IGetBusinessTripsFlightsExpensesByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_flights f
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE t.business_trip_id IN $$businessTripIds;`;

const getBusinessTripsFlightsExpensesByIds = sql<IGetBusinessTripsFlightsExpensesByIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_flights f
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE t.id IN $$expenseIds;`;

const updateBusinessTripFlightsExpense = sql<IUpdateBusinessTripFlightsExpenseQuery>`
  UPDATE accounter_schema.business_trips_transactions_flights
  SET
  path = COALESCE(
    $path,
    path
  ),
  class = COALESCE(
    $class,
    class
  ),
  attendees = COALESCE(
    $attendeeIds,
    attendees
  )
  WHERE
    id = $businessTripExpenseId
  RETURNING *;
`;

const insertBusinessTripFlightsExpense = sql<IInsertBusinessTripFlightsExpenseQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_flights (id, path, class, attendees, owner_id)
  VALUES($id, $path, $class, $attendeeIds, $ownerId)
  RETURNING *;`;

const deleteBusinessTripFlightsExpense = sql<IDeleteBusinessTripFlightsExpenseQuery>`
  DELETE FROM accounter_schema.business_trips_transactions_flights
  WHERE id = $businessTripExpenseId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BusinessTripFlightsExpensesProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  private async batchBusinessTripsFlightsExpensesByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsFlightsExpenses = await getBusinessTripsFlightsExpensesByBusinessTripIds.run(
      {
        businessTripIds,
      },
      this.db,
    );
    return businessTripIds.map(id =>
      businessTripsFlightsExpenses.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsFlightsExpensesByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsFlightsExpensesByBusinessTripIds(ids),
  );

  private async batchBusinessTripsFlightsExpensesByIds(expenseIds: readonly string[]) {
    const businessTripsFlightsExpenses = await getBusinessTripsFlightsExpensesByIds.run(
      {
        expenseIds,
      },
      this.db,
    );
    return expenseIds.map(id => businessTripsFlightsExpenses.find(record => record.id === id));
  }

  public getBusinessTripsFlightsExpensesByIdLoader = new DataLoader((ids: readonly string[]) =>
    this.batchBusinessTripsFlightsExpensesByIds(ids),
  );

  public async updateBusinessTripFlightsExpense(params: IUpdateBusinessTripFlightsExpenseParams) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return updateBusinessTripFlightsExpense.run(params, this.db);
  }

  public async insertBusinessTripFlightsExpense(params: IInsertBusinessTripFlightsExpenseParams) {
    params.attendeeIds ||= [];
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return insertBusinessTripFlightsExpense.run(reassureOwnerIdExists(params, ownerId), this.db);
  }

  public async deleteBusinessTripFlightsExpense(params: IDeleteBusinessTripFlightsExpenseParams) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return deleteBusinessTripFlightsExpense.run(params, this.db);
  }

  public async invalidateById(expenseId: string) {
    const expense = await this.getBusinessTripsFlightsExpensesByIdLoader.load(expenseId);
    if (expense?.business_trip_id) {
      this.getBusinessTripsFlightsExpensesByBusinessTripIdLoader.clear(expense.business_trip_id);
    }
    this.getBusinessTripsFlightsExpensesByIdLoader.clear(expenseId);
  }

  public async invalidateByBusinessTripId(businessTripId: string) {
    const expenses =
      await this.getBusinessTripsFlightsExpensesByBusinessTripIdLoader.load(businessTripId);
    for (const expense of expenses ?? []) {
      this.getBusinessTripsFlightsExpensesByIdLoader.clear(expense.id);
    }
    this.getBusinessTripsFlightsExpensesByBusinessTripIdLoader.clear(businessTripId);
  }

  public clearCache() {
    this.getBusinessTripsFlightsExpensesByBusinessTripIdLoader.clearAll();
    this.getBusinessTripsFlightsExpensesByIdLoader.clearAll();
  }
}
