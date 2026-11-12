// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { TaskRow } from '../components/task-row.js';
import type { TaskState } from '../lib/ws.js';

const state = {
  status: 'done',
  inserted: 1,
  skipped: 0,
  insertedTransactions: [{ id: 'new-1', date: '2026-10-01', description: 'Coffee', amount: '-12' }],
  changedTransactions: [
    { id: 'changed-1', changedFields: [{ field: 'description', oldValue: 'A', newValue: 'B' }] },
    { id: 'changed-2', changedFields: [{ field: 'amount', oldValue: '1', newValue: '2' }] },
  ],
} as TaskState;

async function openDetails() {
  render(<TaskRow sourceId="poalim-1" nickname="Poalim" state={state} />);
  await userEvent.click(screen.getByRole('button', { name: /details/i }));
}

describe('TaskRow — completed run details', () => {
  it('shows new transactions but keeps the changed-transactions list collapsed', async () => {
    await openDetails();
    expect(screen.getByText('Coffee')).toBeTruthy();
    const changed = screen.getByRole('button', { name: /changed transactions \(2\)/i });
    expect(changed.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('changed-1')).toBeNull();
  });

  it('expands and collapses the changed-transactions list', async () => {
    await openDetails();
    const changed = screen.getByRole('button', { name: /changed transactions/i });
    await userEvent.click(changed);
    expect(screen.getByText('changed-1')).toBeTruthy();
    expect(screen.getByText('changed-2')).toBeTruthy();
    await userEvent.click(changed);
    expect(screen.queryByText('changed-1')).toBeNull();
  });

  it('can collapse the new-transactions list too', async () => {
    await openDetails();
    await userEvent.click(screen.getByRole('button', { name: /new transactions \(1\)/i }));
    expect(screen.queryByText('Coffee')).toBeNull();
  });
});
