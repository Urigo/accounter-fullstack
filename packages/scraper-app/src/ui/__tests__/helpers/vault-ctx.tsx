import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';
import { VaultContext, type VaultContextValue } from '../../contexts/vault-context.js';

export function makeVaultCtx(overrides: Partial<VaultContextValue> = {}): VaultContextValue {
  return {
    phase: 'unlocked',
    error: null,
    picked: null,
    fileName: 'mine.vault',
    origin: 'opened',
    changes: { dirty: false, neverSaved: false, items: [] },
    saveMode: 'in-place',
    saving: false,
    pendingDownload: false,
    chooseFile: vi.fn(),
    startCreate: vi.fn(),
    backToWelcome: vi.fn(),
    open: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(true),
    finishSetup: vi.fn(),
    save: vi.fn().mockResolvedValue('saved'),
    confirmDownloaded: vi.fn().mockResolvedValue(undefined),
    downloadCopy: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    refreshChanges: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function WithVault({
  ctx,
  children,
}: {
  ctx: VaultContextValue;
  children: ReactNode;
}): ReactElement {
  return <VaultContext.Provider value={ctx}>{children}</VaultContext.Provider>;
}
