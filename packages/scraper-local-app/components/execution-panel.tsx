'use client';

import { useCallback, useState } from 'react';
import { AlertCircle, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AccountSummary,
  createInitialBankAccountExecution,
  createInitialHapoalimExecution,
  createInitialIsracardExecution,
  createInitialIsracardMonthExecution,
  ExecutionSummary,
  getMonthsToScrape,
  HapoalimExecution,
  IsracardExecution,
  Transaction,
} from '@/lib/execution-types';
import {
  BankAccountConfig,
  isBankAccount,
  isIsracardAccount,
  IsracardAccountConfig,
  ScraperConfig,
} from '@/lib/types';
import { ExecutionSummaryCard } from './execution/execution-summary';
import { HapoalimExecutionView } from './execution/hapoalim-execution';
import { IsracardExecutionView } from './execution/isracard-execution';

interface ExecutionPanelProps {
  config: ScraperConfig;
}

export function ExecutionPanel({ config }: ExecutionPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hapoalimExecutions, setHapoalimExecutions] = useState<HapoalimExecution[]>([]);
  const [isracardExecutions, setIsracardExecutions] = useState<IsracardExecution[]>([]);
  const [summary, setSummary] = useState<ExecutionSummary | null>(null);

  const hapoalimAccounts = config.accounts.filter(
    acc => acc.sourceId === 'hapoalim' && isBankAccount(acc),
  ) as BankAccountConfig[];

  const isracardAccounts = config.accounts.filter(acc =>
    isIsracardAccount(acc),
  ) as IsracardAccountConfig[];

  const totalAccounts = hapoalimAccounts.length + isracardAccounts.length;
  const canExecute = totalAccounts > 0 && config.serverUrl.trim() !== '';

  const updateHapoalimExecution = useCallback(
    (accountId: string, updates: Partial<HapoalimExecution>) => {
      setHapoalimExecutions(prev =>
        prev.map(exec => (exec.accountConfigId === accountId ? { ...exec, ...updates } : exec)),
      );
    },
    [],
  );

  const updateIsracardExecution = useCallback(
    (accountId: string, updates: Partial<IsracardExecution>) => {
      setIsracardExecutions(prev =>
        prev.map(exec => (exec.accountConfigId === accountId ? { ...exec, ...updates } : exec)),
      );
    },
    [],
  );

  const simulateDelay = (min: number, max: number) =>
    new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));

  // Hapoalim transaction flow simulation
  const simulateHapoalimTransactionFlow = async (
    accountId: string,
    bankAccountNumber: string,
    flowType: 'local' | 'foreign' | 'swift',
  ) => {
    // Fetch
    setHapoalimExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          bankAccounts: exec.bankAccounts.map(ba => {
            if (ba.accountNumber !== bankAccountNumber) return ba;
            return {
              ...ba,
              [flowType]: {
                ...ba[flowType],
                fetch: { status: 'running', message: 'Fetching transactions...' },
              },
            };
          }),
        };
      }),
    );

    await simulateDelay(800, 1500);
    const fetchSuccess = Math.random() > 0.1;

    setHapoalimExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          bankAccounts: exec.bankAccounts.map(ba => {
            if (ba.accountNumber !== bankAccountNumber) return ba;
            return {
              ...ba,
              [flowType]: {
                ...ba[flowType],
                fetch: fetchSuccess
                  ? {
                      status: 'success',
                      message: `Found ${Math.floor(Math.random() * 50) + 5} transactions`,
                    }
                  : { status: 'error', error: 'Connection timeout' },
              },
            };
          }),
        };
      }),
    );

    if (!fetchSuccess) return;

    // Normalize
    setHapoalimExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          bankAccounts: exec.bankAccounts.map(ba => {
            if (ba.accountNumber !== bankAccountNumber) return ba;
            return {
              ...ba,
              [flowType]: {
                ...ba[flowType],
                normalize: { status: 'running', message: 'Normalizing data...' },
              },
            };
          }),
        };
      }),
    );

    await simulateDelay(500, 1000);
    const normalizeSuccess = Math.random() > 0.05;

    setHapoalimExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          bankAccounts: exec.bankAccounts.map(ba => {
            if (ba.accountNumber !== bankAccountNumber) return ba;
            return {
              ...ba,
              [flowType]: {
                ...ba[flowType],
                normalize: normalizeSuccess
                  ? { status: 'success', message: 'Data normalized' }
                  : { status: 'error', error: 'Unknown attribute: "txn_type_v2"' },
              },
            };
          }),
        };
      }),
    );

    if (!normalizeSuccess) return;

    // Insert
    setHapoalimExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          bankAccounts: exec.bankAccounts.map(ba => {
            if (ba.accountNumber !== bankAccountNumber) return ba;
            return {
              ...ba,
              [flowType]: {
                ...ba[flowType],
                insert: { status: 'running', message: 'Sending to server...' },
              },
            };
          }),
        };
      }),
    );

    await simulateDelay(600, 1200);
    const insertSuccess = Math.random() > 0.08;

    const mockTransactions: Transaction[] = Array.from(
      { length: Math.floor(Math.random() * 10) + 3 },
      () => ({
        tempId: crypto.randomUUID(),
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        description: [
          'Supermarket',
          'Electric Bill',
          'Salary',
          'Transfer',
          'ATM Withdrawal',
          'Online Purchase',
        ][Math.floor(Math.random() * 6)],
        amount: Math.floor(Math.random() * 5000) - 2000,
        currency: flowType === 'foreign' ? 'USD' : flowType === 'swift' ? 'EUR' : 'ILS',
        type: flowType,
        accountNumber: bankAccountNumber,
        isNew: Math.random() > 0.4,
      }),
    );

    setHapoalimExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          bankAccounts: exec.bankAccounts.map(ba => {
            if (ba.accountNumber !== bankAccountNumber) return ba;
            const newTxCount = mockTransactions.filter(t => t.isNew).length;
            return {
              ...ba,
              [flowType]: {
                ...ba[flowType],
                insert: insertSuccess
                  ? { status: 'success', message: `Inserted ${newTxCount} new transactions` }
                  : { status: 'error', error: 'Server returned 500: Internal error' },
              },
              insertedTransactions: insertSuccess
                ? [...ba.insertedTransactions, ...mockTransactions]
                : ba.insertedTransactions,
            };
          }),
        };
      }),
    );
  };

  const runHapoalimExecution = async (account: BankAccountConfig) => {
    const exec = createInitialHapoalimExecution(
      account.id,
      account.nickname || account.username,
      account.isBusinessAccount,
    );

    setHapoalimExecutions(prev => [...prev.filter(e => e.accountConfigId !== account.id), exec]);

    // Step 1: Login
    updateHapoalimExecution(account.id, {
      login: { status: 'running', message: 'Connecting to Hapoalim...' },
    });

    await simulateDelay(1000, 2000);

    if (account.isBusinessAccount) {
      updateHapoalimExecution(account.id, {
        login: { status: 'waiting-input', message: 'OTP required' },
        otpRequired: true,
      });
      return;
    }

    const loginSuccess = Math.random() > 0.1;
    if (!loginSuccess) {
      updateHapoalimExecution(account.id, {
        login: { status: 'error', error: 'Invalid credentials' },
      });
      return;
    }

    updateHapoalimExecution(account.id, {
      login: { status: 'success', message: 'Logged in successfully' },
    });

    await continueHapoalimAfterLogin(account);
  };

  const continueHapoalimAfterLogin = async (account: BankAccountConfig) => {
    updateHapoalimExecution(account.id, {
      fetchAccounts: { status: 'running', message: 'Fetching bank accounts...' },
    });

    await simulateDelay(800, 1500);

    const discoveredAccounts = ['12345-67', '12345-89', '12345-90'].slice(
      0,
      Math.floor(Math.random() * 3) + 1,
    );

    updateHapoalimExecution(account.id, {
      fetchAccounts: { status: 'success', message: `Found ${discoveredAccounts.length} accounts` },
      discoveredAccounts,
    });

    updateHapoalimExecution(account.id, {
      validateAccounts: { status: 'running', message: 'Validating with server...' },
    });

    await simulateDelay(500, 1000);

    const hasNewAccounts = Math.random() > 0.6;

    if (hasNewAccounts) {
      const existingAccounts = discoveredAccounts.slice(0, 1);
      const newAccounts = discoveredAccounts.slice(1);

      updateHapoalimExecution(account.id, {
        validateAccounts: { status: 'waiting-input', message: 'New accounts detected' },
        validationResult: { existingAccounts, newAccounts },
      });
      return;
    }

    updateHapoalimExecution(account.id, {
      validateAccounts: { status: 'success', message: 'All accounts validated' },
      validationResult: { existingAccounts: discoveredAccounts, newAccounts: [] },
    });

    await processHapoalimAccounts(account.id, discoveredAccounts);
  };

  const processHapoalimAccounts = async (accountId: string, accountNumbers: string[]) => {
    const bankAccounts = accountNumbers.map((num, i) =>
      createInitialBankAccountExecution(num, `Account ${i + 1}`),
    );

    setHapoalimExecutions(prev =>
      prev.map(exec => (exec.accountConfigId === accountId ? { ...exec, bankAccounts } : exec)),
    );

    await Promise.all(
      accountNumbers.map(async accountNumber => {
        await Promise.all([
          simulateHapoalimTransactionFlow(accountId, accountNumber, 'local'),
          simulateHapoalimTransactionFlow(accountId, accountNumber, 'foreign'),
          simulateHapoalimTransactionFlow(accountId, accountNumber, 'swift'),
        ]);
      }),
    );
  };

  const handleOtpSubmit = async (accountId: string, otp: string) => {
    const account = hapoalimAccounts.find(a => a.id === accountId);
    if (!account) return;

    updateHapoalimExecution(accountId, {
      login: { status: 'running', message: 'Verifying OTP...' },
      otpValue: otp,
    });

    await simulateDelay(1000, 1500);

    const otpValid = Math.random() > 0.2;
    if (!otpValid) {
      updateHapoalimExecution(accountId, {
        login: { status: 'error', error: 'Invalid OTP code' },
      });
      return;
    }

    updateHapoalimExecution(accountId, {
      login: { status: 'success', message: 'Logged in with OTP' },
    });

    await continueHapoalimAfterLogin(account);
  };

  const handleNewAccountsDecision = async (accountId: string, skip: boolean) => {
    const execution = hapoalimExecutions.find(e => e.accountConfigId === accountId);
    if (!execution?.validationResult) return;

    updateHapoalimExecution(accountId, {
      validateAccounts: {
        status: 'success',
        message: skip ? 'Skipped new accounts' : 'Setting up new accounts...',
      },
      userSkippedNewAccounts: skip,
    });

    const accountsToProcess = skip
      ? execution.validationResult.existingAccounts
      : [...execution.validationResult.existingAccounts, ...execution.validationResult.newAccounts];

    if (accountsToProcess.length === 0) {
      updateHapoalimExecution(accountId, {
        validateAccounts: { status: 'success', message: 'No accounts to process' },
      });
      return;
    }

    await processHapoalimAccounts(accountId, accountsToProcess);
  };

  // Isracard execution
  const simulateIsracardMonthFlow = async (accountId: string, month: string) => {
    // Fetch
    setIsracardExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          months: exec.months.map(m => {
            if (m.month !== month) return m;
            return {
              ...m,
              flow: {
                ...m.flow,
                fetch: { status: 'running', message: 'Fetching transactions...' },
              },
            };
          }),
        };
      }),
    );

    await simulateDelay(600, 1200);
    const fetchSuccess = Math.random() > 0.1;

    setIsracardExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          months: exec.months.map(m => {
            if (m.month !== month) return m;
            return {
              ...m,
              flow: {
                ...m.flow,
                fetch: fetchSuccess
                  ? {
                      status: 'success',
                      message: `Found ${Math.floor(Math.random() * 30) + 5} transactions`,
                    }
                  : { status: 'error', error: 'Connection timeout' },
              },
            };
          }),
        };
      }),
    );

    if (!fetchSuccess) return;

    // Normalize
    setIsracardExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          months: exec.months.map(m => {
            if (m.month !== month) return m;
            return {
              ...m,
              flow: { ...m.flow, normalize: { status: 'running', message: 'Normalizing data...' } },
            };
          }),
        };
      }),
    );

    await simulateDelay(400, 800);
    const normalizeSuccess = Math.random() > 0.05;

    setIsracardExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          months: exec.months.map(m => {
            if (m.month !== month) return m;
            return {
              ...m,
              flow: {
                ...m.flow,
                normalize: normalizeSuccess
                  ? { status: 'success', message: 'Data normalized' }
                  : { status: 'error', error: 'Unknown merchant code' },
              },
            };
          }),
        };
      }),
    );

    if (!normalizeSuccess) return;

    // Insert
    setIsracardExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          months: exec.months.map(m => {
            if (m.month !== month) return m;
            return {
              ...m,
              flow: { ...m.flow, insert: { status: 'running', message: 'Sending to server...' } },
            };
          }),
        };
      }),
    );

    await simulateDelay(500, 1000);
    const insertSuccess = Math.random() > 0.08;

    const mockTransactions: Transaction[] = Array.from(
      { length: Math.floor(Math.random() * 15) + 3 },
      () => ({
        tempId: crypto.randomUUID(),
        date: month + '-' + String(Math.floor(Math.random() * 28) + 1).padStart(2, '0'),
        description: [
          'Restaurant',
          'Online Shopping',
          'Grocery',
          'Gas Station',
          'Subscription',
          'Travel',
        ][Math.floor(Math.random() * 6)],
        amount: -(Math.floor(Math.random() * 2000) + 50),
        currency: 'ILS',
        type: 'local',
        isNew: Math.random() > 0.4,
      }),
    );

    setIsracardExecutions(prev =>
      prev.map(exec => {
        if (exec.accountConfigId !== accountId) return exec;
        return {
          ...exec,
          months: exec.months.map(m => {
            if (m.month !== month) return m;
            const newTxCount = mockTransactions.filter(t => t.isNew).length;
            return {
              ...m,
              flow: {
                ...m.flow,
                insert: insertSuccess
                  ? { status: 'success', message: `Inserted ${newTxCount} new transactions` }
                  : { status: 'error', error: 'Server returned 500: Internal error' },
              },
              insertedTransactions: insertSuccess ? mockTransactions : [],
            };
          }),
        };
      }),
    );
  };

  const runIsracardExecution = async (account: IsracardAccountConfig) => {
    const monthsToScrape = account.monthsToScrape || 3;
    const months = getMonthsToScrape(monthsToScrape);

    const exec = createInitialIsracardExecution(
      account.id,
      account.nickname || account.username,
      monthsToScrape,
    );
    exec.months = months.map(m => createInitialIsracardMonthExecution(m));

    setIsracardExecutions(prev => [...prev.filter(e => e.accountConfigId !== account.id), exec]);

    // Step 1: Login
    updateIsracardExecution(account.id, {
      login: { status: 'running', message: 'Connecting to Isracard...' },
    });

    await simulateDelay(1000, 2000);

    const loginSuccess = Math.random() > 0.1;
    if (!loginSuccess) {
      updateIsracardExecution(account.id, {
        login: { status: 'error', error: 'Invalid credentials' },
      });
      return;
    }

    updateIsracardExecution(account.id, {
      login: { status: 'success', message: 'Logged in successfully' },
    });

    // Step 2: Process each month (sequentially to avoid rate limiting)
    for (const month of months) {
      await simulateIsracardMonthFlow(account.id, month);
    }
  };

  const computeSummary = (): ExecutionSummary => {
    const accounts: AccountSummary[] = [];
    let totalNewTransactions = 0;
    let totalFailedFlows = 0;

    // Hapoalim accounts
    for (const exec of hapoalimExecutions) {
      let newCount = 0;
      const failedFlows: string[] = [];

      if (exec.login.status === 'error') {
        failedFlows.push('login');
      }

      for (const ba of exec.bankAccounts) {
        newCount += ba.insertedTransactions.filter(t => t.isNew).length;

        if (
          ba.local.fetch.status === 'error' ||
          ba.local.normalize.status === 'error' ||
          ba.local.insert.status === 'error'
        ) {
          failedFlows.push(`${ba.accountNumber} local`);
        }
        if (
          ba.foreign.fetch.status === 'error' ||
          ba.foreign.normalize.status === 'error' ||
          ba.foreign.insert.status === 'error'
        ) {
          failedFlows.push(`${ba.accountNumber} foreign`);
        }
        if (
          ba.swift.fetch.status === 'error' ||
          ba.swift.normalize.status === 'error' ||
          ba.swift.insert.status === 'error'
        ) {
          failedFlows.push(`${ba.accountNumber} swift`);
        }
      }

      totalNewTransactions += newCount;
      totalFailedFlows += failedFlows.length;

      accounts.push({
        accountConfigId: exec.accountConfigId,
        nickname: exec.nickname,
        sourceId: 'hapoalim',
        newTransactionsCount: newCount,
        failedFlows,
        hasErrors: failedFlows.length > 0,
      });
    }

    // Isracard accounts
    for (const exec of isracardExecutions) {
      let newCount = 0;
      const failedFlows: string[] = [];

      if (exec.login.status === 'error') {
        failedFlows.push('login');
      }

      for (const m of exec.months) {
        newCount += m.insertedTransactions.filter(t => t.isNew).length;

        if (
          m.flow.fetch.status === 'error' ||
          m.flow.normalize.status === 'error' ||
          m.flow.insert.status === 'error'
        ) {
          failedFlows.push(m.month);
        }
      }

      totalNewTransactions += newCount;
      totalFailedFlows += failedFlows.length;

      accounts.push({
        accountConfigId: exec.accountConfigId,
        nickname: exec.nickname,
        sourceId: 'isracard',
        newTransactionsCount: newCount,
        failedFlows,
        hasErrors: failedFlows.length > 0,
      });
    }

    return {
      totalNewTransactions,
      totalFailedFlows,
      accounts,
      completedAt: new Date().toISOString(),
    };
  };

  const startExecution = async () => {
    setIsRunning(true);
    setIsComplete(false);
    setHapoalimExecutions([]);
    setIsracardExecutions([]);
    setSummary(null);

    // Run all accounts in parallel
    await Promise.all([
      ...hapoalimAccounts.map(account => runHapoalimExecution(account)),
      ...isracardAccounts.map(account => runIsracardExecution(account)),
    ]);

    setIsRunning(false);
    setIsComplete(true);
    setSummary(computeSummary());
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Execute Scraping</CardTitle>
            <CardDescription>
              Run the scraper for all configured accounts ({totalAccounts} total)
            </CardDescription>
          </div>
          <Button onClick={startExecution} disabled={!canExecute || isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Scraper
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canExecute && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">
              {totalAccounts === 0
                ? 'Add at least one account to run the scraper'
                : 'Configure a server URL to run the scraper'}
            </p>
          </div>
        )}

        {/* Summary Card - shown when execution is complete */}
        {isComplete && summary && <ExecutionSummaryCard summary={summary} />}

        {/* Hapoalim Executions */}
        {hapoalimExecutions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Hapoalim Bank</h3>
            {hapoalimExecutions.map(execution => (
              <HapoalimExecutionView
                key={execution.accountConfigId}
                execution={execution}
                onOtpSubmit={otp => handleOtpSubmit(execution.accountConfigId, otp)}
                onNewAccountsDecision={skip =>
                  handleNewAccountsDecision(execution.accountConfigId, skip)
                }
              />
            ))}
          </div>
        )}

        {/* Isracard Executions */}
        {isracardExecutions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Isracard</h3>
            {isracardExecutions.map(execution => (
              <IsracardExecutionView key={execution.accountConfigId} execution={execution} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
