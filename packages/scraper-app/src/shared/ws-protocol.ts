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

export const ScrapeStartedSchema = z.object({
  type: z.literal('scrape-started'),
  sourceIds: z.array(z.string()),
});

export const ScrapeProgressSchema = z.object({
  type: z.literal('scrape-progress'),
  sourceId: z.string(),
  sourceType: z.enum(SOURCE_TYPES),
  status: z.enum(['running', 'done', 'error', 'blocked']),
  error: z.string().optional(),
});

export const ScrapeCompleteSchema = z.object({
  type: z.literal('scrape-complete'),
  totalTransactions: z.number(),
});

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

export const ServerMessageSchema = z.discriminatedUnion('type', [
  ConnectedSchema,
  ScrapeStartedSchema,
  ScrapeProgressSchema,
  ScrapeCompleteSchema,
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
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
