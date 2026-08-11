export type * from './__generated__/types.js';
// `DateOrString` and `Json` are emitted by more than one generated module now that
// both the control and ingest providers read jsonb/timestamp columns. They are
// structurally identical, so pick one source explicitly to resolve the ambiguity.
export type { DateOrString, Json } from './__generated__/email-ingestion-control.types.js';
export type * from './__generated__/email-ingestion-control.types.js';
export type * from './__generated__/email-ingestion-alias.types.js';
export type * from './__generated__/email-ingestion-ingest.types.js';
