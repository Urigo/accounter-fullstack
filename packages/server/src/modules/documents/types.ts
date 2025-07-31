import type { document_status } from './__generated__/issued-documents.types.js';

export type { DateOrString } from './__generated__/documents.types.js';
export type * from './__generated__/documents.types.js';
export type * from './__generated__/issued-documents.types.js';
export type * from './__generated__/types.js';

export type IssuedDocumentInfoProto = {
  externalId: string;
  status: document_status;
  linkedDocumentIds?: string[];
} | null;
