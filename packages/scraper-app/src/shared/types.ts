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
  completedAt: string;
  totalInserted: number;
  totalSkipped: number;
  errorCount: number;
  sources: SourceRunRecord[];
};

/** One difference between the in-memory vault and the last saved (or opened) vault file. */
export type VaultChangeItem = {
  section: 'sources' | 'accounts' | 'settings';
  kind: 'added' | 'removed' | 'edited';
  /** Source id, account record id, or settings key. */
  id: string;
  /** Source type for `sources` items, or the owning source's type for `accounts` items. */
  sourceType?: string;
  /** Human label: source nickname, account number, or settings key. Never a secret value. */
  label: string;
};

export type VaultChanges = {
  /** The session holds changes the vault file does not have. */
  dirty: boolean;
  /** A newly created vault that has never been saved to a file. */
  neverSaved: boolean;
  items: VaultChangeItem[];
};

export type VaultStatusResponse =
  | { state: 'empty' }
  | {
      state: 'unlocked';
      sessionId: string;
      origin: 'new' | 'opened';
      fileName: string;
      changes: VaultChanges;
    };
