// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { History, formatDuration } from '../screens/history.js';
import type { RunRecord } from '../../shared/types.js';

function mockFetch(records: RunRecord[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => records }) as Response),
  );
}

const BASE_TIME = '2024-06-01T10:00:00.000Z';
const LATER_TIME = '2024-06-01T10:02:30.000Z'; // +2m 30s

function makeRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: 'run-1',
    startedAt: BASE_TIME,
    completedAt: LATER_TIME,
    totalInserted: 10,
    totalSkipped: 2,
    errorCount: 0,
    sources: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('History screen', () => {
  it('renders empty state when response is []', async () => {
    mockFetch([]);
    render(<History />);
    await waitFor(() => {
      expect(screen.getByText(/no scrape runs recorded yet/i)).toBeTruthy();
    });
  });

  it('renders correct number of rows from mock API response', async () => {
    mockFetch([
      makeRecord({ id: 'run-1' }),
      makeRecord({ id: 'run-2', totalInserted: 5 }),
      makeRecord({ id: 'run-3', totalInserted: 1 }),
    ]);
    render(<History />);
    await waitFor(() => {
      expect(
        screen.getAllByRole('button').filter(el => el.hasAttribute('aria-expanded')).length,
      ).toBe(3);
    });
  });

  it('expanding a row shows per-source detail', async () => {
    const record = makeRecord({
      sources: [{ sourceId: 'src-poalim', nickname: 'Poalim', sourceType: 'poalim', status: 'done', inserted: 7, skipped: 1 }],
    });
    mockFetch([record]);
    render(<History />);

    await waitFor(() => screen.getByRole('table', { name: /scrape history/i }));
    const dataRow = screen.getAllByRole('button').find(el => el.hasAttribute('aria-expanded'));
    expect(dataRow).toBeTruthy();
    await userEvent.setup().click(dataRow!);

    await waitFor(() => {
      expect(screen.getByText('Poalim')).toBeTruthy();
      expect(screen.getByText('poalim')).toBeTruthy();
    });
  });

  it('duration is calculated and displayed as Xm Ys', () => {
    expect(formatDuration(BASE_TIME, LATER_TIME)).toBe('2m 30s');
    expect(formatDuration(BASE_TIME, BASE_TIME)).toBe('0m 0s');
    expect(formatDuration('2024-01-01T00:00:00.000Z', '2024-01-01T00:01:00.000Z')).toBe('1m 0s');
  });

  it('Refresh button re-fetches data', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [] }) as Response);
    vi.stubGlobal('fetch', fetchMock);

    render(<History />);
    await waitFor(() => screen.getByText(/no scrape runs recorded yet/i));

    const callsBefore = fetchMock.mock.calls.length;
    await userEvent.setup().click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
