import { act, StrictMode, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
  useLocation,
  useNavigate,
  useNavigationType,
  type InitialEntry,
  type Location,
  type NavigateFunction,
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDocumentViewerStore, useDocumentViewer } from '../../../../hooks/use-document-viewer.js';
import { useSidebar } from '../../../../hooks/use-sidebar.js';
import type { DocumentViewerEntry } from '../types.js';
import { isDocViewerState, useOverlayHistory } from '../use-overlay-history.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOC_A: DocumentViewerEntry = {
  id: 'doc-a',
  imageUrl: 'https://example.com/a.jpg',
  fileUrl: null,
  title: 'Tax Invoice 1042',
};
const DOC_B: DocumentViewerEntry = { ...DOC_A, id: 'doc-b', title: 'Receipt 7' };

let container: HTMLDivElement;
let root: Root;
let navigate: NavigateFunction;
let location: Location;
/** Every location the router committed, with how it got there. */
let visits: { key: string; action: string; flagged: boolean }[];
let requestClose: () => void;

/** Records each committed location once, however often StrictMode renders it. */
function LocationProbe(): null {
  navigate = useNavigate();
  location = useLocation();
  const action = useNavigationType();
  if (visits.at(-1)?.key !== location.key) {
    visits.push({ key: location.key, action, flagged: isDocViewerState(location.state) });
  }
  return null;
}

/** The overlay host's wiring, without the dialog. */
function Harness(): null {
  const active = useDocumentViewer(
    s => !!s.current && s.placement === 'overlay' && s.overlayMode === 'fullscreen',
  );
  const close = useDocumentViewer(s => s.close);
  requestClose = useOverlayHistory({ active, close });
  return null;
}

function App({ initialEntries }: { initialEntries: InitialEntry[] }): ReactElement {
  return (
    <StrictMode>
      <MemoryRouter initialEntries={initialEntries}>
        <LocationProbe />
        <Harness />
      </MemoryRouter>
    </StrictMode>
  );
}

function setViewportWidth(width: number): void {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: width,
  });
}

async function mount(initialEntries: InitialEntry[] = ['/documents?page=1']): Promise<void> {
  await act(async () => root.render(<App initialEntries={initialEntries} />));
}

async function openDoc(entry: DocumentViewerEntry = DOC_A): Promise<void> {
  await act(async () => useDocumentViewer.getState().open(entry));
}

const pushes = (): number => visits.filter(v => v.action === 'PUSH').length;

/**
 * Proves a single entry was pushed: one Back lands on the first location. The probe alone can't,
 * since two pushes in one tick commit only the last location.
 */
async function expectOneEntryAbove(firstKey: string): Promise<void> {
  await act(async () => navigate(-1));
  expect(location.key).toBe(firstKey);
  expect(useDocumentViewer.getState().current).toBeNull();
}

beforeEach(() => {
  resetDocumentViewerStore();
  useSidebar.setState({ isMinimized: true });
  // Under 1024px: the full-screen overlay, which owns a history entry.
  setViewportWidth(390);
  visits = [];
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('isDocViewerState', () => {
  it.each<[unknown, boolean]>([
    [{ docViewer: true }, true],
    [{ docViewer: true, from: '/x' }, true],
    [{ docViewer: undefined }, false],
    [{ docViewer: 'yes' }, false],
    [null, false],
    ['docViewer', false],
  ])('%j → %s', (state, expected) => {
    expect(isDocViewerState(state)).toBe(expected);
  });
});

describe('useOverlayHistory', () => {
  it('opening pushes exactly one entry, on the same location, keeping its state', async () => {
    await mount([{ pathname: '/documents', search: '?page=1', state: { from: 'charges' } }]);
    const firstKey = location.key;
    await openDoc();

    expect(pushes()).toBe(1);
    expect(location.pathname + location.search).toBe('/documents?page=1');
    expect(location.state).toEqual({ from: 'charges', docViewer: true });
    await expectOneEntryAbove(firstKey);
  });

  it("pushes once when StrictMode's double effect runs with a document already open", async () => {
    useDocumentViewer.getState().open(DOC_A);
    await mount();
    const firstKey = visits[0]?.key ?? '';

    expect(pushes()).toBe(1);
    expect(isDocViewerState(location.state)).toBe(true);
    expect(useDocumentViewer.getState().current?.id).toBe('doc-a');
    await expectOneEntryAbove(firstKey);
  });

  it('swapping documents while open does not navigate', async () => {
    await mount();
    await openDoc(DOC_A);
    await openDoc(DOC_B);

    expect(pushes()).toBe(1);
    expect(visits).toHaveLength(2);
    expect(useDocumentViewer.getState().current?.id).toBe('doc-b');
  });

  it('Back (navigate(-1)) closes the viewer', async () => {
    await mount();
    await openDoc();
    await act(async () => navigate(-1));

    expect(useDocumentViewer.getState().current).toBeNull();
    expect(isDocViewerState(location.state)).toBe(false);
    expect(pushes()).toBe(1);
  });

  it('✕ goes back instead of closing first, and the Back path closes', async () => {
    await mount();
    await openDoc();
    const pushedKey = location.key;

    await act(async () => requestClose());

    expect(useDocumentViewer.getState().current).toBeNull();
    expect(visits.at(-1)).toMatchObject({ action: 'POP', flagged: false });
    expect(location.key).not.toBe(pushedKey);
    // Back landed on the original entry; nothing was replaced on the way.
    expect(visits.filter(v => v.action === 'REPLACE')).toHaveLength(0);
  });

  it('a second ✕ while the back navigation is pending does not go back twice', async () => {
    await mount(['/documents', '/documents?page=1']);
    await openDoc();
    await act(async () => {
      requestClose();
      requestClose();
    });

    expect(location.pathname + location.search).toBe('/documents?page=1');
    expect(useDocumentViewer.getState().current).toBeNull();
  });

  it('replaces a leftover flag on mount (a reload restores history.state)', async () => {
    await mount([{ pathname: '/documents', state: { docViewer: true, from: 'x' } }]);

    expect(isDocViewerState(location.state)).toBe(false);
    expect(location.state).toEqual({ from: 'x', docViewer: undefined });
    expect(visits.map(v => v.action)).toEqual(['POP', 'REPLACE']);
  });

  it('replaces the flag when Forward re-enters an entry the overlay left', async () => {
    await mount();
    await openDoc();
    await act(async () => requestClose());
    await act(async () => navigate(1));

    expect(useDocumentViewer.getState().current).toBeNull();
    expect(isDocViewerState(location.state)).toBe(false);
    expect(visits.at(-1)?.action).toBe('REPLACE');
  });

  it('steps off its entry when the store closes some other way', async () => {
    await mount();
    await openDoc();
    await act(async () => useDocumentViewer.getState().close());

    expect(isDocViewerState(location.state)).toBe(false);
    expect(visits.at(-1)?.action).toBe('POP');
  });

  it('the sheet above a modal never touches history', async () => {
    setViewportWidth(1440);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const trigger = document.createElement('button');
    dialog.append(trigger);
    document.body.append(dialog);

    await mount();
    await act(async () => useDocumentViewer.getState().open(DOC_A, { trigger }));
    expect(useDocumentViewer.getState().overlayMode).toBe('sheet');
    await act(async () => requestClose());

    expect(useDocumentViewer.getState().current).toBeNull();
    expect(visits).toHaveLength(1);
    dialog.remove();
  });
});

describe('useOverlayHistory with a data router', () => {
  // The app runs on `RouterProvider`, whose navigations commit asynchronously, so StrictMode's
  // second effect run sees the location from before the push. Only the ref guard stops a second
  // push there.
  it("pushes once when StrictMode's double effect runs before the push lands", async () => {
    useDocumentViewer.getState().open(DOC_A);
    const router = createMemoryRouter(
      [
        {
          path: '/documents',
          element: (
            <>
              <LocationProbe />
              <Harness />
            </>
          ),
        },
      ],
      { initialEntries: ['/documents'] },
    );
    await act(async () =>
      root.render(
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>,
      ),
    );
    const firstKey = visits[0]?.key ?? '';

    expect(isDocViewerState(router.state.location.state)).toBe(true);
    await act(async () => router.navigate(-1));
    expect(router.state.location.key).toBe(firstKey);
    expect(useDocumentViewer.getState().current).toBeNull();
    router.dispose();
  });
});
