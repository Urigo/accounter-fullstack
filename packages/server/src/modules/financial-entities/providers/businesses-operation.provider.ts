import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { BusinessTripAttendeesProvider } from '@modules/business-trips/providers/business-trips-attendees.provider.js';
import { DividendsProvider } from '@modules/dividends/providers/dividends.provider.js';
import { BalanceCancellationProvider } from '@modules/ledger/providers/balance-cancellation.provider.js';
import { UnbalancedBusinessesProvider } from '@modules/ledger/providers/unbalanced-businesses.provider.js';
import { EmployeesProvider } from '@modules/salaries/providers/employees.provider.js';
import { FundsProvider } from '@modules/salaries/providers/funds.provider.js';
import { sql } from '@pgtyped/runtime';
import type { IDeleteBusinessQuery } from '../types.js';
import { BusinessesProvider } from './businesses.provider.js';
import { ClientsProvider } from './clients.provider.js';
import { TaxCategoriesProvider } from './tax-categories.provider.js';

const deleteBusiness = sql<IDeleteBusinessQuery>`
  DELETE FROM accounter_schema.businesses
  WHERE id = $businessId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BusinessesOperationProvider {
  constructor(
    @Inject(CONTEXT) private context: GraphQLModules.Context,
    private dbProvider: DBProvider,
    private businessesProvider: BusinessesProvider,
    private taxCategoryProvider: TaxCategoriesProvider,
    private clientsProvider: ClientsProvider,
    private employeesProvider: EmployeesProvider,
    private fundsProvider: FundsProvider,
    private dividendsProvider: DividendsProvider,
    private businessTripAttendeesProvider: BusinessTripAttendeesProvider,
    private balanceCancellationProvider: BalanceCancellationProvider,
    private unbalancedBusinessesProvider: UnbalancedBusinessesProvider,
  ) {}

  public async deleteBusinessById(businessId: string) {
    this.businessesProvider.invalidateBusinessById(businessId);

    // remove employee
    const employeePromise = this.employeesProvider.getEmployeesByIdLoader
      .load(businessId)
      .then(employee => {
        if (employee) throw new Error('Cannot delete business as it represent an employee');
      });

    // remove pension funds
    const fundPromise = this.fundsProvider.getAllFunds().then(funds => {
      const fund = funds.find(f => f.id === businessId);
      if (fund) throw new Error('Cannot delete business as it represent a pension/training fund');
    });

    // remove business trips attendees
    const tripsPromise = this.businessTripAttendeesProvider
      .getBusinessTripsByAttendeeId(businessId)
      .then(trips => {
        if (trips.length)
          throw new Error('Cannot delete business as it represent business trip attendee');
      });

    // remove from dividends
    const dividendsPromise = this.dividendsProvider.getDividendsByBusinessIdLoader
      .load(businessId)
      .then(dividends => {
        if (dividends.length)
          throw new Error('Cannot delete business as it represent dividends receiver');
      });

    // some validations before deleting the business
    await Promise.all([employeePromise, tripsPromise, fundPromise, dividendsPromise]);

    // remove from charge unbalanced ledger businesses
    const deleteUnbalancedChargesBusinesses =
      this.unbalancedBusinessesProvider.deleteChargeUnbalancedBusinessesByBusinessId(businessId);

    // remove from charge balance cancellation
    const deleteBalanceCancellation =
      this.balanceCancellationProvider.deleteBalanceCancellationByBusinessId(businessId);

    // remove from business green invoice match
    const deleteGreenInvoiceMatch = this.clientsProvider.deleteClient(businessId);

    // TODO: remove when corporate: corporate-tax-variables
    // TODO: remove when owner: financial entities, charges, business-tax-category, ledger

    // TODO: should remove transactions, documents?

    // remove business-tax-category matches
    const deleteMatchingTaxCategory = this.taxCategoryProvider.deleteBusinessTaxCategory({
      businessId,
      ownerId: this.context.currentUser.userId,
    });

    await Promise.all([
      deleteUnbalancedChargesBusinesses,
      deleteBalanceCancellation,
      deleteGreenInvoiceMatch,
      deleteMatchingTaxCategory,
    ]);

    // delete businesses
    deleteBusiness.run({ businessId }, this.dbProvider);
  }
}
