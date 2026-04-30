// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsTab } from '../screens/config/accounts-tab.js';

type BankAccount = {
  id: string;
  sourceId: string;
  sourceType: string;
  accountNumber: string;
  branchNumber?: string;
  status: 'accepted' | 'ignored' | 'pending';
};

function mockFetch(initial: BankAccount[]) {
  let accounts = [...initial];
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/vault/accounts') {
      return { ok: true, json: async () => accounts } as Response;
    }
    const putMatch = (url as string).match(/\/api\/vault\/accounts\/(.+)/);
    if (putMatch && options?.method === 'PUT') {
      const id = putMatch[1];
      const { status } = JSON.parse(options.body as string) as { status: BankAccount['status'] };
      accounts = accounts.map(a => (a.id === id ? { ...a, status } : a));
      return { ok: true, json: async () => accounts } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const SAMPLE_ACCOUNTS: BankAccount[] = [
  {
    id: 'acc-1',
    sourceId: 'src-a',
    sourceType: 'poalim',
    accountNumber: '123456',
    branchNumber: '700',
    status: 'pending',
  },
  {
    id: 'acc-2',
    sourceId: 'src-a',
    sourceType: 'poalim',
    accountNumber: '789012',
    status: 'accepted',
  },
  {
    id: 'acc-3',
    sourceId: 'src-b',
    sourceType: 'max',
    accountNumber: '333333',
    status: 'ignored',
  },
];

beforeEach(() => {
  mockFetch([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountsTab', () => {
  it('renders empty state when no accounts', async () => {
    render(<AccountsTab />);
    await waitFor(() => {
      expect(screen.getByText(/no bank accounts discovered/i)).toBeTruthy();
    });
  });

  it('renders status badges for each account', async () => {
    vi.unstubAllGlobals();
    mockFetch(SAMPLE_ACCOUNTS);
    render(<AccountsTab />);

    await waitFor(() => screen.getAllByText('pending'));
    expect(screen.getAllByText('accepted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ignored').length).toBeGreaterThan(0);
  });

  it('shows pending notice for pending accounts', async () => {
    vi.unstubAllGlobals();
    mockFetch(SAMPLE_ACCOUNTS);
    render(<AccountsTab />);

    await waitFor(() => {
      expect(screen.getByText(/visit the accounter client/i)).toBeTruthy();
    });
  });

  it('changes status via dropdown', async () => {
    vi.unstubAllGlobals();
    const fetchMock = mockFetch(SAMPLE_ACCOUNTS);
    render(<AccountsTab />);

    await waitFor(() => screen.getAllByRole('combobox'));
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const pendingSelect = selects.find(s => s.value === 'pending')!;

    await userEvent.selectOptions(pendingSelect, 'accepted');

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([, opts]) => (opts as RequestInit | undefined)?.method === 'PUT',
      );
      expect(putCalls.length).toBeGreaterThan(0);
    });
  });

  it('groups accounts by source', async () => {
    vi.unstubAllGlobals();
    mockFetch(SAMPLE_ACCOUNTS);
    render(<AccountsTab />);

    await waitFor(() => {
      expect(screen.getByText(/Bank Hapoalim \(src-a\)/)).toBeTruthy();
      expect(screen.getByText(/Max \(src-b\)/)).toBeTruthy();
    });
  });

  it('after status change the badge updates', async () => {
    vi.unstubAllGlobals();
    mockFetch([SAMPLE_ACCOUNTS[0]]);
    render(<AccountsTab />);

    await waitFor(() => screen.getAllByText('pending'));
    const select = screen.getByRole('combobox') as HTMLSelectElement;

    await userEvent.selectOptions(select, 'accepted');

    await waitFor(() => {
      expect(screen.getAllByText('accepted').length).toBeGreaterThan(0);
    });
  });
});
