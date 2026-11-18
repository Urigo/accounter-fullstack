import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AVERAGE_MONTHLY_WORK_DAYS } from '../../../../shared/constants.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { EmployeesProvider } from '../../../salaries/providers/employees.provider.js';
import { SalariesProvider } from '../../../salaries/providers/salaries.provider.js';
import { LedgerProvider } from '../../providers/ledger.provider.js';
import { calculateVacationReserveAmount } from '../vacation-reserve.helper.js';

/* All names, IDs and amounts below are made up. */
const EMPLOYEE_NAME = 'Zebulon';
const RESERVE = 'vacation-reserve';
const EXPENSE = 'vacation-expenses';

type Employee = {
  business_id: string;
  first_name?: string;
  start_work_date: string;
  end_work_date: string | null;
};

type SalaryRecord = {
  employee_id: string;
  month: string;
  job_percentage?: string;
  base_salary?: string;
  global_additional_hours?: string | null;
  hourly_rate?: string;
  hours?: string;
  vacation_days_balance?: string | null;
};

const DEFAULT_EMPLOYEE: Employee = {
  business_id: 'employee',
  first_name: EMPLOYEE_NAME,
  start_work_date: '2023-06-01',
  end_work_date: null,
};

const DEFAULT_SALARIES: SalaryRecord[] = [
  {
    employee_id: 'employee',
    month: '2024-03',
    job_percentage: '100',
    base_salary: '10000',
    global_additional_hours: '0',
    vacation_days_balance: '2',
  },
];

function monthly(
  employeeId: string,
  month: string,
  balance: string | null,
  overrides: Partial<SalaryRecord> = {},
): SalaryRecord {
  return {
    employee_id: employeeId,
    month,
    job_percentage: '100',
    base_salary: '21670',
    global_additional_hours: '0',
    vacation_days_balance: balance,
    ...overrides,
  };
}

function monthsOf(year: number) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

/** A prior-year booking of the reserve: Dr expense / Cr reserve when positive. */
function priorReserveRecord(amount: number, valueDate = '2024-12-31') {
  const isDecrease = amount < 0;
  return {
    value_date: valueDate,
    credit_entity1: isDecrease ? EXPENSE : RESERVE,
    debit_entity1: isDecrease ? RESERVE : EXPENSE,
    credit_local_amount1: String(Math.abs(amount)),
  };
}

function makeInjector({
  salaries = DEFAULT_SALARIES,
  employees = [DEFAULT_EMPLOYEE],
  ledgerRecords = [],
}: {
  salaries?: SalaryRecord[];
  employees?: Employee[];
  ledgerRecords?: unknown[];
} = {}) {
  const getSalaryRecordsByDates = vi.fn(
    async ({ fromDate, toDate }: { fromDate: string; toDate: string }) =>
      salaries.filter(record => record.month >= fromDate && record.month <= toDate),
  );
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: async () => ({
          ownerId: 'owner',
          salaries: {
            vacationReserveExpensesTaxCategoryId: EXPENSE,
            vacationReserveTaxCategoryId: RESERVE,
          },
        }),
      },
    ],
    [SalariesProvider, { getSalaryRecordsByDates }],
    [EmployeesProvider, { getEmployeesByEmployerLoader: { load: async () => employees } }],
    [
      LedgerProvider,
      { getLedgerRecordsByFinancialEntityIdLoader: { load: async () => ledgerRecords } },
    ],
  ]);
  return {
    injector: { get: (token: unknown) => providers.get(token) } as unknown as Injector,
    getSalaryRecordsByDates,
  };
}

async function reserveFor(year: number, options: Parameters<typeof makeInjector>[0] = {}) {
  const { vacationReserveAmount } = await calculateVacationReserveAmount(
    makeInjector(options).injector,
    year,
  );
  return vacationReserveAmount;
}

async function errorFor(year: number, options: Parameters<typeof makeInjector>[0] = {}) {
  const error = await calculateVacationReserveAmount(makeInjector(options).injector, year).catch(
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(GraphQLError);
  return error as GraphQLError;
}

// base salary 21,670 / 21.67 average monthly work days = 1,000 a day
const DAILY_WAGE = 1000;

describe('calculateVacationReserveAmount', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs no employee names or amounts', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );

    const vacationReserveAmount = await reserveFor(2024);

    expect(vacationReserveAmount).not.toBe(0);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['has no salary records', []],
    [
      'has no valid salary amount',
      [monthly('employee', '2024-03', '2', { base_salary: '0', global_additional_hours: '0' })],
    ],
    ['has no vacation days balance', [monthly('employee', '2024-03', null)]],
  ])('names the employee by ID, not first name, when it %s', async (_, salaries) => {
    const error = await errorFor(2024, { salaries });

    expect(error.message).toContain('employee');
    expect(error.message).not.toContain(EMPLOYEE_NAME);
  });

  it('only reads the salary records of the requested year', async () => {
    const { injector, getSalaryRecordsByDates } = makeInjector();

    await calculateVacationReserveAmount(injector, 2024);

    expect(getSalaryRecordsByDates).toHaveBeenCalledWith({
      fromDate: '2024-01',
      toDate: '2024-12',
    });
  });

  describe('balances', () => {
    it('uses the year-end balance when it is steady, not the sum of monthly balances', async () => {
      const salaries = monthsOf(2025).map(month => monthly('employee', month, '10'));

      expect(await reserveFor(2025, { salaries })).toBe(10 * DAILY_WAGE);
    });

    it('uses the year-end balance when it rises (1 day accrued a month)', async () => {
      const salaries = [...monthsOf(2024), ...monthsOf(2025)].map((month, i) =>
        monthly('employee', month, String(i + 1)),
      );
      const employees = [{ ...DEFAULT_EMPLOYEE, start_work_date: '2024-01-01' }];

      // 24 days, not 1 + 2 + … + 24 = 300 plus a statutory entitlement on top
      expect(await reserveFor(2025, { salaries, employees })).toBe(24 * DAILY_WAGE);
    });

    it('uses the latest record in the year even when records are unordered', async () => {
      const salaries = [
        monthly('employee', '2025-12', '7'),
        monthly('employee', '2025-06', '15'),
        monthly('employee', '2025-01', '20'),
      ];

      expect(await reserveFor(2025, { salaries })).toBe(7 * DAILY_WAGE);
    });

    it('returns a negative delta when the balance falls below last year', async () => {
      const salaries = monthsOf(2025).map((month, i) => monthly('employee', month, String(20 - i)));

      // closing reserve 9 days; last year's reserve was 20 days
      expect(
        await reserveFor(2025, {
          salaries,
          ledgerRecords: [priorReserveRecord(20 * DAILY_WAGE)],
        }),
      ).toBe((9 - 20) * DAILY_WAGE);
    });

    it('nets out every prior booking, in both directions', async () => {
      const salaries = [monthly('employee', '2025-12', '12')];
      const ledgerRecords = [
        priorReserveRecord(15 * DAILY_WAGE, '2023-12-31'),
        priorReserveRecord(-5 * DAILY_WAGE, '2024-12-31'),
        // the current year's own booking is not part of the opening reserve
        priorReserveRecord(999, '2025-12-31'),
      ];

      expect(await reserveFor(2025, { salaries, ledgerRecords })).toBe((12 - 10) * DAILY_WAGE);
    });

    it('accepts a zero balance', async () => {
      const salaries = [monthly('employee', '2025-12', '0')];

      expect(await reserveFor(2025, { salaries })).toBe(0);
    });
  });

  describe('employee types', () => {
    it('applies part-time once, through the salary, for monthly-paid employees', async () => {
      const salaries = [
        monthly('employee', '2025-12', '10', { job_percentage: '50', base_salary: '10835' }),
      ];

      // 10 days × (10,835 / 21.67 = 500), with no extra 50% factor on the days
      expect(await reserveFor(2025, { salaries })).toBe(10 * 500);
    });

    it('includes global additional hours in the daily wage', async () => {
      const salaries = [
        monthly('employee', '2025-12', '10', {
          base_salary: '17336',
          global_additional_hours: '4334',
        }),
      ];

      expect(await reserveFor(2025, { salaries })).toBe(10 * DAILY_WAGE);
    });

    it("values hourly employees' days by their average monthly hours", async () => {
      const hourly = (month: string, hours: string, balance: string) =>
        monthly('employee', month, balance, {
          job_percentage: '0',
          base_salary: undefined,
          hourly_rate: '50',
          hours,
        });
      const salaries = [hourly('2025-10', '80', '4'), hourly('2025-11', '100', '5'), hourly('2025-12', '93', '6')];

      // average 91 hours a month × 50 an hour / 21.67 days
      const expected = Math.round((6 * 50 * 91) / AVERAGE_MONTHLY_WORK_DAYS);
      expect(await reserveFor(2025, { salaries })).toBe(expected);
    });

    it('releases the reserve of an employee who left during the year', async () => {
      const employees = [{ ...DEFAULT_EMPLOYEE, end_work_date: '2025-08-31' }];
      const salaries = monthsOf(2025)
        .slice(0, 8)
        .map(month => monthly('employee', month, '10'));

      expect(
        await reserveFor(2025, {
          employees,
          salaries,
          ledgerRecords: [priorReserveRecord(8 * DAILY_WAGE)],
        }),
      ).toBe(-8 * DAILY_WAGE);
    });

    it('counts an employee hired during the year from their latest balance', async () => {
      const employees = [
        DEFAULT_EMPLOYEE,
        { business_id: 'new-hire', start_work_date: '2025-09-15', end_work_date: null },
      ];
      const salaries = [
        monthly('employee', '2025-12', '10'),
        // before the hire date: ignored
        monthly('new-hire', '2025-08', '99'),
        monthly('new-hire', '2025-09', '0.5'),
        monthly('new-hire', '2025-12', '3.5'),
      ];

      expect(await reserveFor(2025, { employees, salaries })).toBe((10 + 3.5) * DAILY_WAGE);
    });

    it('ignores employees hired after the year', async () => {
      const employees = [
        DEFAULT_EMPLOYEE,
        { business_id: 'future-hire', start_work_date: '2026-02-01', end_work_date: null },
      ];
      const salaries = [monthly('employee', '2025-12', '10')];

      expect(await reserveFor(2025, { employees, salaries })).toBe(10 * DAILY_WAGE);
    });
  });

  describe('missing data', () => {
    it('lists every employee whose year-end balance is missing', async () => {
      const employees = [
        DEFAULT_EMPLOYEE,
        { business_id: 'employee-b', start_work_date: '2020-01-01', end_work_date: null },
        { business_id: 'employee-c', start_work_date: '2020-01-01', end_work_date: null },
      ];
      const salaries = [
        monthly('employee', '2025-12', '10'),
        // a November balance does not stand in for a missing December one
        monthly('employee-b', '2025-11', '5'),
        monthly('employee-b', '2025-12', null),
        monthly('employee-c', '2025-12', ''),
      ];

      const error = await errorFor(2025, { employees, salaries });

      expect(error.message).toContain('vacation days balance');
      expect(error.message).toContain('employee-b');
      expect(error.message).toContain('employee-c');
      expect(error.message).not.toMatch(/\bemployee\b(?!-)/);
    });

    it('lists active employees with no salary record in the year', async () => {
      const salaries = [monthly('employee', '2024-12', '10')];

      const error = await errorFor(2025, { salaries });

      expect(error.message).toContain('no salary records in 2025');
      expect(error.message).toContain('employee');
    });
  });
});
