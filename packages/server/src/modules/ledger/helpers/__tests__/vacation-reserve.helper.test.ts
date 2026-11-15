import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { EmployeesProvider } from '../../../salaries/providers/employees.provider.js';
import { SalariesProvider } from '../../../salaries/providers/salaries.provider.js';
import { LedgerProvider } from '../../providers/ledger.provider.js';
import { calculateVacationReserveAmount } from '../vacation-reserve.helper.js';

/* All names, IDs and amounts below are made up. */
const EMPLOYEE_NAME = 'Zebulon';

const DEFAULT_SALARIES = [
  // Before the employee's start date: skipped
  { employee_id: 'employee', month: '2023-01', job_percentage: '100' },
  {
    employee_id: 'employee',
    month: '2024-03',
    job_percentage: '100',
    base_salary: '10000',
    global_additional_hours: '0',
    vacation_days_balance: '2',
  },
];

function makeInjector(salaries: unknown[] = DEFAULT_SALARIES) {
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: async () => ({
          ownerId: 'owner',
          salaries: {
            vacationReserveExpensesTaxCategoryId: 'vacation-expenses',
            vacationReserveTaxCategoryId: 'vacation-reserve',
          },
        }),
      },
    ],
    [
      SalariesProvider,
      {
        getSalaryRecordsByDates: async () => salaries,
      },
    ],
    [
      EmployeesProvider,
      {
        getEmployeesByEmployerLoader: {
          load: async () => [
            {
              business_id: 'employee',
              first_name: EMPLOYEE_NAME,
              start_work_date: '2023-06-01',
              end_work_date: null,
            },
          ],
        },
      },
    ],
    [LedgerProvider, { getLedgerRecordsByFinancialEntityIdLoader: { load: async () => [] } }],
  ]);
  return { get: (token: unknown) => providers.get(token) } as unknown as Injector;
}

describe('calculateVacationReserveAmount', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs no employee names or amounts', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );

    const { vacationReserveAmount } = await calculateVacationReserveAmount(makeInjector(), 2024);

    expect(vacationReserveAmount).not.toBe(0);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['has no salary records', []],
    [
      'has no valid salary amount',
      [{ employee_id: 'employee', month: '2024-03', job_percentage: '100', base_salary: '0' }],
    ],
  ])('names the employee by ID, not first name, when it %s', async (_, salaries) => {
    const error = await calculateVacationReserveAmount(makeInjector(salaries), 2024).catch(
      (error: unknown) => error,
    );

    expect(error).toBeInstanceOf(GraphQLError);
    expect((error as GraphQLError).message).toContain('employee');
    expect((error as GraphQLError).message).not.toContain(EMPLOYEE_NAME);
  });
});
