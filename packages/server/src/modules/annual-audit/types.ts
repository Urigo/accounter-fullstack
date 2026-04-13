export type * from './__generated__/types.js';
export type * from './__generated__/annual-audit.types.js';

export type AnnualAuditStepStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'BLOCKED';

export interface AnnualAuditStepStatusResult {
  id: string;
  ownerId: string;
  year: number;
  stepId: string;
  status: AnnualAuditStepStatus;
  notes?: string | null;
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
