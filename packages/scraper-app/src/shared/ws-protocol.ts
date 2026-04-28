import { z } from 'zod';
import { SOURCE_TYPES } from './source-types.js';

// ── Client → Server ──────────────────────────────────────────────────────────

export const StartScrapeSchema = z.object({
  type: z.literal('start-scrape'),
  sourceIds: z.array(z.string()).optional(),
});

export const CancelScrapeSchema = z.object({
  type: z.literal('cancel-scrape'),
});

export const PingSchema = z.object({
  type: z.literal('ping'),
});

export const RunStartSchema = z.object({
  type: z.literal('run-start'),
  sourceIds: z.array(z.string()).optional(),
});

export type RunStartMessage = z.infer<typeof RunStartSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  StartScrapeSchema,
  CancelScrapeSchema,
  PingSchema,
  RunStartSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ── Server → Client ──────────────────────────────────────────────────────────

export const ConnectedSchema = z.object({
  type: z.literal('connected'),
});

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

export const TaskBlockedSchema = z.object({
  type: z.literal('task-blocked'),
  sourceId: z.string(),
  sourceType: z.enum(SOURCE_TYPES),
  unknownAccounts: z.array(z.string()),
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

export const TaskRunningSchema = z.object({
  type: z.literal('task-running'),
  sourceId: z.string(),
});

export const TaskDoneSchema = z.object({
  type: z.literal('task-done'),
  sourceId: z.string(),
  inserted: z.number(),
  skipped: z.number(),
  insertedIds: z.array(z.string()),
});

export const RunCompleteSchema = z.object({
  type: z.literal('run-complete'),
  totalInserted: z.number(),
  totalSkipped: z.number(),
});

export const RunErrorSchema = z.object({
  type: z.literal('run-error'),
  message: z.string(),
});

export const ServerMessageSchema = z.discriminatedUnion('type', [
  ConnectedSchema,
  ScrapeStartedSchema,
  ScrapeProgressSchema,
  TaskBlockedSchema,
  ScrapeCompleteSchema,
  PongSchema,
  WsErrorSchema,
  TaskPendingSchema,
  TaskRunningSchema,
  TaskDoneSchema,
  RunCompleteSchema,
  RunErrorSchema,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
