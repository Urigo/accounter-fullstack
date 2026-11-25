import React, { act, useEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useQueryMock, dirtyState } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  dirtyState: { dirty: false },
}));

vi.mock('urql', () => ({ useQuery: useQueryMock }));

vi.mock('../../../../../gql/graphql.js', () => ({
  Form1214SupportedYearsDocument: { name: 'years' },
  Form1214ReportScreenDocument: { name: 'report' },
}));

vi.mock('../download-button.js', () => ({ Form1214DownloadButton: () => null }));
vi.mock('../validation-panel.js', () => ({ Form1214ValidationPanel: () => null }));
vi.mock('../../../../ui/select.js', () => ({
  Select: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));
// A section that reports unsaved edits as `dirtyState` says
vi.mock('../report-sections.js', async () => {
  const { useForm1214Report } = await import('../report-context.js');
  return {
    Form1214ReportSections: (): ReactElement | null => {
      const { setDirty } = useForm1214Report();
      useEffect(() => setDirty('test', dirtyState.dirty), [setDirty]);
      return null;
    },
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Form1214Report } from '../index.js';

const PAGE = '/reports/1214';

let container: HTMLDivElement;
let root: Root;
let router: ReturnType<typeof createMemoryRouter>;
let confirmMock: ReturnType<typeof vi.fn<(message?: string) => boolean>>;

async function renderPage(dirty: boolean): Promise<void> {
  dirtyState.dirty = dirty;
  router = createMemoryRouter(
    [
      { path: PAGE, element: <Form1214Report /> },
      { path: '/other', element: <p>other page</p> },
    ],
    { initialEntries: [`${PAGE}?year=2025`] },
  );
  await act(async () => root.render(<RouterProvider router={router} />));
}

async function navigate(to: string): Promise<void> {
  await act(async () => {
    await router.navigate(to);
  });
}

function fireBeforeUnload(): Event {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  useQueryMock.mockImplementation(({ query }: { query: { name: string } }) =>
    query.name === 'years'
      ? [{ data: { report1214SupportedYears: [2024, 2025] }, fetching: false }]
      : [
          {
            data: {
              report1214: {
                id: 'r',
                year: 2025,
                owner: { id: 'o', name: 'Owner Ltd' },
                validation: { isValid: true },
              },
            },
            fetching: false,
          },
          vi.fn(),
        ],
  );
  confirmMock = vi.fn<(message?: string) => boolean>();
  // The test DOM has no `window.confirm`
  Object.defineProperty(window, 'confirm', {
    value: confirmMock,
    configurable: true,
    writable: true,
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Form1214Report navigation guard', () => {
  it('asks before leaving the page with unsaved edits, and stays when declined', async () => {
    await renderPage(true);
    confirmMock.mockReturnValue(false);
    await navigate('/other');
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe(PAGE);

    confirmMock.mockReturnValue(true);
    await navigate('/other');
    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(router.state.location.pathname).toBe('/other');
  });

  it('leaves without asking when nothing is unsaved', async () => {
    await renderPage(false);
    await navigate('/other');
    expect(confirmMock).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/other');
  });

  it('does not ask again for a year change on the page itself', async () => {
    await renderPage(true);
    await navigate(`${PAGE}?year=2024`);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(router.state.location.search).toBe('?year=2024');
  });

  it('has the browser ask before a reload or closing the tab only while edits are unsaved', async () => {
    await renderPage(true);
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
    act(() => root.unmount());
    root = createRoot(container);

    await renderPage(false);
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });
});
