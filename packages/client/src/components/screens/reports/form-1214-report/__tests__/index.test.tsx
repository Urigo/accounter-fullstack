import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const { useQueryMock, navigateMock, location } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  navigateMock: vi.fn(),
  location: { search: '?year=2019', hash: '#shareholders' },
}));

vi.mock('urql', () => ({ useQuery: useQueryMock }));

vi.mock('react-router-dom', () => ({
  useLocation: () => location,
  useNavigate: () => navigateMock,
  useSearchParams: () => [new URLSearchParams(location.search)],
  useBlocker: () => ({ state: 'unblocked' }),
}));

vi.mock('../../../../../gql/graphql.js', () => ({
  Form1214SupportedYearsDocument: { name: 'years' },
  Form1214ReportScreenDocument: { name: 'report' },
}));

vi.mock('../download-button.js', () => ({ Form1214DownloadButton: () => null }));
vi.mock('../validation-panel.js', () => ({ Form1214ValidationPanel: () => null }));
vi.mock('../report-sections.js', () => ({ Form1214ReportSections: () => null }));
vi.mock('../../../../ui/select.js', () => ({
  Select: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Form1214Report } from '../index.js';

describe('Form1214Report', () => {
  it('replaces an unsupported URL year with the latest supported one, once, keeping the hash', async () => {
    useQueryMock.mockImplementation(({ query }: { query: { name: string } }) =>
      query.name === 'years'
        ? [{ data: { report1214SupportedYears: [2024, 2025] }, fetching: false }]
        : [{ data: undefined, fetching: true }, vi.fn()],
    );

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Form1214Report />));
    // another render with the same URL must not navigate again
    await act(async () => root.render(<Form1214Report />));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith(
      { search: '?year=2025', hash: '#shareholders' },
      { replace: true },
    );
    // the report is queried for the year the page shows, not the URL's unsupported one
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { year: 2025 }, pause: false }),
    );

    await act(async () => root.unmount());
    container.remove();
  });
});
