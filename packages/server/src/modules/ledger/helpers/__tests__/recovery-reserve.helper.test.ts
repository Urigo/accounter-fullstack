import type { Injector } from 'graphql-modules';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { EmployeesProvider } from '../../../salaries/providers/employees.provider.js';
import { RecoveryProvider } from '../../../salaries/providers/recovery.provider.js';
import { SalariesProvider } from '../../../salaries/providers/salaries.provider.js';
import { LedgerProvider } from '../../providers/ledger.provider.js';
import { calculateRecoveryReserveAmount } from '../recovery-reserve.helper.js';

/* All names, IDs and amounts below are made up. */
const EMPLOYEE_NAME = 'Zebulon';

function makeInjector() {
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: async () => ({
          ownerId: 'owner',
          salaries: {
            recoveryReserveExpensesTaxCategoryId: 'recovery-expenses',
            recoveryReserveTaxCategoryId: 'recovery-reserve',
          },
        }),
      },
    ],
    [
      SalariesProvider,
      {
        getSalaryRecordsByDates: async () => [
          // Before the employee's start date: skipped
          { employee_id: 'employee', month: '2023-01', job_percentage: '100', recovery: null },
          { employee_id: 'employee', month: '2024-03', job_percentage: '100', recovery: '100' },
        ],
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
    [RecoveryProvider, { getRecoveryData: async () => [{ year: 2024, day_value: '418' }] }],
    [LedgerProvider, { getLedgerRecordsByFinancialEntityIdLoader: { load: async () => [] } }],
  ]);
  return { get: (token: unknown) => providers.get(token) } as unknown as Injector;
}

describe('calculateRecoveryReserveAmount', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs no employee names or amounts', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );

    const { recoveryReserveAmount } = await calculateRecoveryReserveAmount(makeInjector(), 2024);

    expect(recoveryReserveAmount).not.toBe(0);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
