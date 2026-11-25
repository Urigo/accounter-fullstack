import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const { markDoneMock } = vi.hoisted(() => ({ markDoneMock: vi.fn() }));

vi.mock('../../../../../../hooks/use-annual-audit-step.js', () => ({
  useAnnualAuditStep: () => ({
    status: 'pending',
    saving: false,
    fetchingStatus: false,
    handleMarkDone: markDoneMock,
    handleUnmark: vi.fn(),
  }),
}));

vi.mock('../../step-base.js', () => ({
  BaseStepCard: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Step18Form1214 } from '../index.js';

describe('Step18Form1214', () => {
  it('links to the 1214 report of the audited year and can be marked done', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Step18Form1214
          id="18"
          title="Generate 1214 Report"
          year={2025}
          adminBusinessId="owner"
          manualData={[]}
        />,
      );
    });

    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/reports/1214?year=2025');
    expect(link?.textContent).toContain('Open 1214 Report');
    expect(link?.getAttribute('target')).toBe('_blank');

    const markDone = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Mark as Done',
    );
    expect(markDone).toBeDefined();
    await act(async () => markDone?.click());
    expect(markDoneMock).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    container.remove();
  });
});
