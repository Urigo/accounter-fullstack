// @vitest-environment happy-dom

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Run } from '../screens/run.js';
import { useRunSocket } from '../lib/ws.js';

function RunWithSocket(props: { onNavigateAccounts?: () => void }) {
  const socket = useRunSocket();
  return <Run {...socket} {...props} />;
}

// ── WebSocket mock ────────────────────────────────────────────────────────────

type MessageHandler = (event: { data: string }) => void;

let wsInstance: MockWs | null = null;

class MockWs {
  readyState = WebSocket.OPEN;
  onmessage: MessageHandler | null = null;
  sent: unknown[] = [];

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {}

  /** Push a server message into the component */
  push(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

beforeEach(() => {
  wsInstance = new MockWs();
  const MockWebSocketCtor = function MockWebSocketCtor() {
    return wsInstance;
  };
  MockWebSocketCtor.OPEN = 1;
  MockWebSocketCtor.CONNECTING = 0;
  MockWebSocketCtor.CLOSING = 2;
  MockWebSocketCtor.CLOSED = 3;
  vi.stubGlobal('WebSocket', MockWebSocketCtor);
  // Stub fetch → empty sources list
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => [] }) as Response),
  );
});

afterEach(() => {
  wsInstance = null;
  vi.unstubAllGlobals();
});

function ws(): MockWs {
  if (!wsInstance) throw new Error('no ws');
  return wsInstance;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function push(msg: object) {
  act(() => ws().push(msg));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Run screen', () => {
  it('"Run" button fires run-start message', async () => {
    // provide one source so the button is not disabled due to no selection
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => [{ id: 'src-1', type: 'poalim', userCode: 'u', password: 'p' }],
      }) as Response),
    );

    render(<RunWithSocket />);
    await waitFor(() => expect(screen.queryByRole('button', { name: /^run$/i })).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: /^run$/i }));

    expect(ws().sent).toContainEqual(
      expect.objectContaining({ type: 'run-start', sourceIds: ['src-1'] }),
    );
  });

  it('task-pending → task-running → TaskRow shows correct states', async () => {
    render(<RunWithSocket />);
    await waitFor(() => screen.getByRole('button', { name: /^run$/i }));

    push({ type: 'task-pending', sourceId: 'src-1' });
    await waitFor(() => expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0));

    push({ type: 'task-running', sourceId: 'src-1' });
    // The badge text contains "Running…" (with ellipsis), distinct from the button "Running…"
    await waitFor(() => expect(screen.getAllByText(/running/i).length).toBeGreaterThan(0));
  });

  it('task-done → TaskRow shows green with counts', async () => {
    render(<RunWithSocket />);
    await waitFor(() => screen.getByRole('button', { name: /^run$/i }));

    push({ type: 'task-pending', sourceId: 'src-1' });
    push({ type: 'task-done', sourceId: 'src-1', inserted: 5, skipped: 2, insertedIds: [] });

    await waitFor(() => {
      expect(screen.getByText(/done/i)).toBeTruthy();
      expect(screen.getByText(/5 new/i)).toBeTruthy();
      expect(screen.getByText(/2 skipped/i)).toBeTruthy();
    });
  });

  it('task-error → TaskRow shows red with message', async () => {
    render(<RunWithSocket />);
    await waitFor(() => screen.getByRole('button', { name: /^run$/i }));

    push({ type: 'task-pending', sourceId: 'src-1' });
    push({ type: 'task-error', sourceId: 'src-1', message: 'Login failed' });

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeTruthy();
    });

    // Expand details to see message
    await userEvent.click(screen.getByRole('button', { name: /details/i }));
    await waitFor(() => expect(screen.getByText(/Login failed/)).toBeTruthy());
  });

  it('task-blocked → TaskRow shows yellow with account IDs', async () => {
    render(<RunWithSocket />);
    await waitFor(() => screen.getByRole('button', { name: /^run$/i }));

    push({
      type: 'task-blocked',
      sourceId: 'src-1',
      sourceType: 'poalim',
      unknownAccounts: ['ACC-001', 'ACC-002'],
    });

    await waitFor(() => {
      expect(screen.getByText(/blocked/i)).toBeTruthy();
      expect(screen.getByText(/ACC-001/)).toBeTruthy();
      expect(screen.getByText(/ACC-002/)).toBeTruthy();
    });
  });

  it('otp-required → OtpModal appears; submit closes modal and sends otp-submit', async () => {
    render(<RunWithSocket />);
    await waitFor(() => screen.getByRole('button', { name: /^run$/i }));

    push({ type: 'task-pending', sourceId: 'src-1' });
    push({ type: 'otp-required', sourceId: 'src-1' });

    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    await userEvent.type(screen.getByLabelText(/otp code/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /submit otp/i }));

    expect(ws().sent).toContainEqual({ type: 'otp-submit', sourceId: 'src-1', otp: '123456' });
  });

  it('run-complete → summary panel renders; Run button re-enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => [{ id: 'src-1', type: 'poalim', userCode: 'u', password: 'p' }],
      }) as Response),
    );

    render(<RunWithSocket />);
    await waitFor(() => screen.getByRole('button', { name: /^run$/i }));

    // Simulate a running state then completion
    push({ type: 'task-pending', sourceId: 'src-1' });
    push({ type: 'task-running', sourceId: 'src-1' });
    push({ type: 'task-done', sourceId: 'src-1', inserted: 3, skipped: 1, insertedIds: [] });
    push({ type: 'run-complete', totalInserted: 3, totalSkipped: 1, errors: 0 });

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /run summary/i })).toBeTruthy();
    });

    // Run button should be enabled again
    const runBtn = screen.getByRole('button', { name: /^run$/i });
    expect((runBtn as HTMLButtonElement).disabled).toBe(false);
  });
});
