export type SourceRunRecord = {
  sourceId: string;
  sourceType: string;
  inserted: number;
  skipped: number;
  error?: string;
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
