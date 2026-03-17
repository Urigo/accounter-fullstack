import { getServer } from './server-requests.js';

export type EmailDocument = {
  filename?: string;
  content?: string;
  mimeType?: string;
};

export interface EmailData {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  originalFrom?: string;
  replyTo?: string;
  to: string;
  body: string;
  labels: string[];
  receivedAt: Date;
  documents?: EmailDocument[];
}

export type Labels = 'processed' | 'main' | 'errors' | 'debug';

export type Server = ReturnType<typeof getServer>;
