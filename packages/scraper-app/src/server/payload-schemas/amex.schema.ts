import type { IsracardPayload } from './isracard.schema.js';

// Amex uses the same card-portal structure as Isracard

export type AmexPayload = IsracardPayload;

export { IsracardPayloadSchema as AmexPayloadSchema } from './isracard.schema.js';
