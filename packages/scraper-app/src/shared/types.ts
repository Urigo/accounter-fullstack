export type SourceRunRecord = {
  sourceId: string;
  nickname: string;
  sourceType: string;
  status: 'done' | 'error' | 'blocked';
  inserted: number;
  skipped: number;
  error?: string;
  blockedAccounts?: string[];
};

export type RunRecord = {
  id: string;
  startedAt: string; // ISO string for JSON serialization
  finishedAt: string;
  totalInserted: number;
  totalSkipped: number;
  errorCount: number;
  sources: SourceRunRecord[];
};
