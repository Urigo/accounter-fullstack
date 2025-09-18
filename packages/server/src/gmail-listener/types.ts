export interface EmailData {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  labels: string[];
  receivedAt: Date;
}
