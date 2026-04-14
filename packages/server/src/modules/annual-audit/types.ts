export type * from './__generated__/types.js';
export type * from './__generated__/annual-audit.types.js';

export type AnnualAuditStepStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'BLOCKED';
export type AnnualAuditOpeningBalanceUserType = 'NEW' | 'MIGRATING' | 'CONTINUING' | 'ERROR';

export interface AnnualAuditOpeningBalanceStatusResult {
  id: string;
  userType: AnnualAuditOpeningBalanceUserType;
  balanceChargeId: string | null;
  derivedStatus: AnnualAuditStepStatus;
  errorMessage?: string | null;
}

export interface AnnualAuditStepStatusResult {
  id: string;
  ownerId: string;
  year: number;
  stepId: string;
  status: AnnualAuditStepStatus;
  notes?: string | null;
  evidence?: string | null;
  updatedAt: Date;
  completedAt?: Date | null;
}

export interface SetAnnualAuditStepStatusInput {
  ownerId: string;
  year: number;
  stepId: string;
  status: AnnualAuditStepStatus;
  notes?: string | null;
}

export interface SetAnnualAuditStep09StatusInput {
  ownerId: string;
  year: number;
  templateName: string;
}
