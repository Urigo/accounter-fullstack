import { z } from 'zod';
import { SOURCE_TYPES } from './source-types.js';

// ── Client → Server ──────────────────────────────────────────────────────────

export const CancelScrapeSchema = z.object({
  type: z.literal('cancel-scrape'),
});

export const PingSchema = z.object({
  type: z.literal('ping'),
});

export const RunStartSchema = z.object({
  type: z.literal('run-start'),
  sourceIds: z.array(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type RunStartMessage = z.infer<typeof RunStartSchema>;

export const OtpSubmitSchema = z.object({
  type: z.literal('otp-submit'),
  sourceId: z.string(),
  otp: z.string(),
});

export type OtpSubmitMessage = z.infer<typeof OtpSubmitSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  CancelScrapeSchema,
  PingSchema,
  RunStartSchema,
  OtpSubmitSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ── Server → Client ──────────────────────────────────────────────────────────

export const ConnectedSchema = z.object({
  type: z.literal('connected'),
});

export type ConnectedMessage = z.infer<typeof ConnectedSchema>;

export const PongSchema = z.object({
  type: z.literal('pong'),
});

export const WsErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

export const TaskPendingSchema = z.object({
  type: z.literal('task-pending'),
  sourceId: z.string(),
});

export type TaskPendingMessage = z.infer<typeof TaskPendingSchema>;

export const TaskRunningSchema = z.object({
  type: z.literal('task-running'),
  sourceId: z.string(),
});

export type TaskRunningMessage = z.infer<typeof TaskRunningSchema>;

const InsertedTransactionSummarySchema = z.object({
  id: z.string(),
  date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  amount: z.string().nullable().optional(),
  account: z.string().nullable().optional(),
});

const ChangedFieldSchema = z.object({
  field: z.string(),
  oldValue: z.string().nullable().optional(),
  newValue: z.string().nullable().optional(),
});

const ChangedTransactionSchema = z.object({
  id: z.string(),
  changedFields: z.array(ChangedFieldSchema),
});

export const TaskDoneSchema = z.object({
  type: z.literal('task-done'),
  sourceId: z.string(),
  inserted: z.number(),
  skipped: z.number(),
  insertedIds: z.array(z.string()),
  insertedTransactions: z.array(InsertedTransactionSummarySchema).optional(),
  changedTransactions: z.array(ChangedTransactionSchema).optional(),
});

export type TaskDoneMessage = z.infer<typeof TaskDoneSchema>;

export const TaskErrorSchema = z.object({
  type: z.literal('task-error'),
  sourceId: z.string(),
  message: z.string(),
  stack: z.string().optional(),
});

export type TaskErrorMessage = z.infer<typeof TaskErrorSchema>;

export const TaskBlockedSchema = z.object({
  type: z.literal('task-blocked'),
  sourceId: z.string(),
  sourceType: z.enum(SOURCE_TYPES),
  unknownAccounts: z.array(z.string()),
});

export type TaskBlockedMessage = z.infer<typeof TaskBlockedSchema>;

export const OtpRequiredSchema = z.object({
  type: z.literal('otp-required'),
  sourceId: z.string(),
  prompt: z.string().optional(),
});

export type OtpRequiredMessage = z.infer<typeof OtpRequiredSchema>;

export const RunCompleteSchema = z.object({
  type: z.literal('run-complete'),
  totalInserted: z.number(),
  totalSkipped: z.number(),
  errors: z.number(),
});

export type RunCompleteMessage = z.infer<typeof RunCompleteSchema>;

export const RunErrorSchema = z.object({
  type: z.literal('run-error'),
  message: z.string(),
});

// ── Per-month progress (Isracard, Amex, Discount, Cal) ───────────────────────

export const TaskMonthFetchingSchema = z.object({
  type: z.literal('task-month-fetching'),
  sourceId: z.string(),
  month: z.string(),
});

export const TaskMonthFetchedSchema = z.object({
  type: z.literal('task-month-fetched'),
  sourceId: z.string(),
  month: z.string(),
  transactionCount: z.number(),
});

export const TaskMonthErrorSchema = z.object({
  type: z.literal('task-month-error'),
  sourceId: z.string(),
  month: z.string(),
  error: z.string(),
});

export const TaskMonthUploadingSchema = z.object({
  type: z.literal('task-month-uploading'),
  sourceId: z.string(),
  month: z.string(),
  transactionCount: z.number(),
});

export const TaskMonthUploadedSchema = z.object({
  type: z.literal('task-month-uploaded'),
  sourceId: z.string(),
  month: z.string(),
  inserted: z.number(),
  skipped: z.number(),
});

// ── Per-account progress (Poalim) ─────────────────────────────────────────────

export const TaskAccountsFoundSchema = z.object({
  type: z.literal('task-accounts-found'),
  sourceId: z.string(),
  accounts: z.array(
    z.object({
      accountNumber: z.string(),
      branchNumber: z.number(),
      bankNumber: z.number(),
    }),
  ),
});

export const TaskAccountVaultCheckedSchema = z.object({
  type: z.literal('task-account-vault-checked'),
  sourceId: z.string(),
  accountId: z.string(),
  status: z.enum(['accepted', 'ignored', 'blocked', 'unknown']),
});

export const TaskAccountTxnsFetchingSchema = z.object({
  type: z.literal('task-account-txns-fetching'),
  sourceId: z.string(),
  accountId: z.string(),
  txnType: z.enum(['ils', 'foreign', 'swift']),
});

export const TaskAccountTxnsUploadingSchema = z.object({
  type: z.literal('task-account-txns-uploading'),
  sourceId: z.string(),
  accountId: z.string(),
  txnType: z.enum(['ils', 'foreign', 'swift']),
  count: z.number(),
});

export const TaskAccountTxnsDoneSchema = z.object({
  type: z.literal('task-account-txns-done'),
  sourceId: z.string(),
  accountId: z.string(),
  txnType: z.enum(['ils', 'foreign', 'swift']),
  inserted: z.number(),
  skipped: z.number(),
});

export const ServerMessageSchema = z.discriminatedUnion('type', [
  ConnectedSchema,
  PongSchema,
  WsErrorSchema,
  TaskPendingSchema,
  TaskRunningSchema,
  TaskDoneSchema,
  TaskErrorSchema,
  TaskBlockedSchema,
  OtpRequiredSchema,
  RunCompleteSchema,
  RunErrorSchema,
  TaskMonthFetchingSchema,
  TaskMonthFetchedSchema,
  TaskMonthErrorSchema,
  TaskMonthUploadingSchema,
  TaskMonthUploadedSchema,
  TaskAccountsFoundSchema,
  TaskAccountVaultCheckedSchema,
  TaskAccountTxnsFetchingSchema,
  TaskAccountTxnsUploadingSchema,
  TaskAccountTxnsDoneSchema,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
