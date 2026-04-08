export type StepStatus = 'idle' | 'running' | 'success' | 'error' | 'waiting-input';

export interface StepResult {
  status: StepStatus;
  message?: string;
  error?: string;
  data?: unknown;
}

export interface TransactionFlowStep {
  fetch: StepResult;
  normalize: StepResult;
  insert: StepResult;
}

export interface Transaction {
  tempId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: 'local' | 'foreign' | 'swift';
  accountNumber?: string;
  isNew?: boolean;
}

export interface BankAccountExecution {
  accountNumber: string;
  accountName: string;
  local: TransactionFlowStep;
  foreign: TransactionFlowStep;
  swift: TransactionFlowStep;
  insertedTransactions: Transaction[];
}

export interface ServerValidationResult {
  existingAccounts: string[];
  newAccounts: string[];
}

export interface HapoalimExecution {
  accountConfigId: string;
  nickname: string;
  isBusinessAccount: boolean;

  // Step 1: Login
  login: StepResult;
  otpRequired?: boolean;
  otpValue?: string;

  // Step 2: Fetch bank accounts
  fetchAccounts: StepResult;
  discoveredAccounts?: string[];

  // Step 3: Validate against server
  validateAccounts: StepResult;
  validationResult?: ServerValidationResult;
  userSkippedNewAccounts?: boolean;

  // Step 4: Per-account execution
  bankAccounts: BankAccountExecution[];
}

// Isracard Types
export interface IsracardMonthExecution {
  month: string; // YYYY-MM
  flow: TransactionFlowStep;
  insertedTransactions: Transaction[];
}

export interface IsracardExecution {
  accountConfigId: string;
  nickname: string;
  monthsToScrape: number;

  // Step 1: Login
  login: StepResult;

  // Step 2: Per-month execution
  months: IsracardMonthExecution[];

  // Step 3: Summary (computed)
  totalNewTransactions: number;
}

// Summary Types
export interface AccountSummary {
  accountConfigId: string;
  nickname: string;
  sourceId: string;
  newTransactionsCount: number;
  failedFlows: string[];
  hasErrors: boolean;
}

export interface ExecutionSummary {
  totalNewTransactions: number;
  totalFailedFlows: number;
  accounts: AccountSummary[];
  completedAt: string;
}

export interface ExecutionState {
  isRunning: boolean;
  isComplete: boolean;
  hapoalimExecutions: HapoalimExecution[];
  isracardExecutions: IsracardExecution[];
  summary?: ExecutionSummary;
}

export function createInitialTransactionFlow(): TransactionFlowStep {
  return {
    fetch: { status: 'idle' },
    normalize: { status: 'idle' },
    insert: { status: 'idle' },
  };
}

export function createInitialBankAccountExecution(
  accountNumber: string,
  accountName: string,
): BankAccountExecution {
  return {
    accountNumber,
    accountName,
    local: createInitialTransactionFlow(),
    foreign: createInitialTransactionFlow(),
    swift: createInitialTransactionFlow(),
    insertedTransactions: [],
  };
}

export function createInitialHapoalimExecution(
  accountConfigId: string,
  nickname: string,
  isBusinessAccount: boolean,
): HapoalimExecution {
  return {
    accountConfigId,
    nickname,
    isBusinessAccount,
    login: { status: 'idle' },
    fetchAccounts: { status: 'idle' },
    validateAccounts: { status: 'idle' },
    bankAccounts: [],
  };
}

export function createInitialIsracardMonthExecution(month: string): IsracardMonthExecution {
  return {
    month,
    flow: createInitialTransactionFlow(),
    insertedTransactions: [],
  };
}

export function createInitialIsracardExecution(
  accountConfigId: string,
  nickname: string,
  monthsToScrape: number,
): IsracardExecution {
  return {
    accountConfigId,
    nickname,
    monthsToScrape,
    login: { status: 'idle' },
    months: [],
    totalNewTransactions: 0,
  };
}

export function getMonthsToScrape(count: number): string[] {
  const months: string[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(date.toISOString().slice(0, 7));
  }
  return months;
}
