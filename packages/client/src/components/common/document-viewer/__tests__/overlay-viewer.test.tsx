import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDocumentViewerStore, useDocumentViewer } from '../../../../hooks/use-document-viewer.js';
import { useSidebar } from '../../../../hooks/use-sidebar.js';
import { Dialog, DialogContent, DialogTitle } from '../../../ui/dialog.js';
import { OverlayDocumentViewer, OverlayViewerFrame } from '../overlay-viewer.js';
import type { DocumentViewerEntry } from '../types.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOC: DocumentViewerEntry = {
  id: 'doc-1',
  imageUrl: 'https://example.com/scan.jpg',
  fileUrl: null,
  title: 'Tax Invoice 1042',
};

let container: HTMLDivElement;
let root: Root;

function setViewportWidth(width: number): void {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: width,
  });
}

beforeEach(() => {
  resetDocumentViewerStore();
  useSidebar.setState({ isMinimized: true });
  setViewportWidth(1440);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function overlay(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-slot="document-viewer-overlay"]');
}

/** Radix listens for Esc on the document; dispatch from wherever focus is, as a real key does. */
async function pressEscape(): Promise<void> {
  const target = document.activeElement ?? document.body;
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  });
}

function makeTrigger(parent: HTMLElement = document.body): HTMLButtonElement {
  const trigger = document.createElement('button');
  trigger.textContent = 'thumbnail';
  parent.append(trigger);
  return trigger;
}

async function renderHost(extra?: ReactElement): Promise<void> {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/documents']}>
        {extra}
        <OverlayDocumentViewer />
      </MemoryRouter>,
    ),
  );
}

describe('OverlayViewerFrame', () => {
  it('renders a titled dialog with no backdrop element', async () => {
    await act(async () =>
      root.render(<OverlayViewerFrame entry={DOC} open mode="fullscreen" onClose={() => {}} />),
    );

    const dialog = overlay();
    expect(dialog?.getAttribute('role')).toBe('dialog');
    const labelledBy = dialog?.getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(labelledBy)?.textContent).toBe('Tax Invoice 1042');
    // No `Dialog.Overlay`: the only thing in the body besides the test root is the dialog's portal.
    expect(document.body.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
    expect(document.body.querySelector('.bg-black\\/50')).toBeNull();
    expect(dialog?.hasAttribute('aria-describedby')).toBe(false);
    // The viewer is inside, with ✕ and no Expand.
    expect(dialog?.querySelector('[data-slot="document-viewer"]')).not.toBeNull();
    expect(dialog?.querySelector('[aria-label="Close document viewer"]')).not.toBeNull();
    expect(dialog?.querySelector('[aria-label="Expand document viewer"]')).toBeNull();
  });

  it.each([
    ['fullscreen', ['fixed', 'inset-0', 'z-1001'], ['w-1/2']],
    ['sheet', ['fixed', 'inset-y-0', 'right-0', 'z-1001', 'w-1/2', 'min-w-105'], ['inset-0']],
  ] as const)('%s uses its classes', async (mode, present, absent) => {
    await act(async () =>
      root.render(<OverlayViewerFrame entry={DOC} open mode={mode} onClose={() => {}} />),
    );
    const classes = overlay()?.classList;
    expect(overlay()?.dataset.mode).toBe(mode);
    for (const name of present) {
      expect(classes?.contains(name), name).toBe(true);
    }
    for (const name of absent) {
      expect(classes?.contains(name), name).toBe(false);
    }
    // Never above the body-portaled tooltips and menus at z-1001.
    expect(classes?.contains('z-1002')).toBe(false);
  });

  it('focuses the canvas on open', async () => {
    await act(async () =>
      root.render(<OverlayViewerFrame entry={DOC} open mode="sheet" onClose={() => {}} />),
    );
    expect(document.activeElement?.getAttribute('data-slot')).toBe('document-viewer-canvas');
  });

  it('renders nothing when closed or without an entry', async () => {
    await act(async () =>
      root.render(<OverlayViewerFrame entry={DOC} open={false} mode="sheet" onClose={() => {}} />),
    );
    expect(overlay()).toBeNull();
    await act(async () =>
      root.render(<OverlayViewerFrame entry={null} open mode="sheet" onClose={() => {}} />),
    );
    expect(overlay()).toBeNull();
  });

  it('Esc in the zoom input cancels the edit and keeps the overlay open', async () => {
    const onClose = vi.fn();
    await act(async () =>
      root.render(<OverlayViewerFrame entry={DOC} open mode="sheet" onClose={onClose} />),
    );
    const input = document.createElement('input');
    input.setAttribute('data-local-escape', '');
    overlay()?.append(input);
    input.focus();
    await pressEscape();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('OverlayDocumentViewer', () => {
  it('opens for the overlay placement only', async () => {
    await renderHost();
    await act(async () => useDocumentViewer.getState().open(DOC));
    expect(useDocumentViewer.getState().placement).toBe('docked');
    expect(overlay()).toBeNull();
  });

  it('Esc closes the full-screen overlay and focus returns to the trigger', async () => {
    setViewportWidth(390);
    const trigger = makeTrigger();
    await renderHost();
    await act(async () => useDocumentViewer.getState().open(DOC, { trigger }));
    expect(overlay()?.dataset.mode).toBe('fullscreen');

    await pressEscape();

    expect(useDocumentViewer.getState().current).toBeNull();
    expect(overlay()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('✕ closes the sheet and focus returns to the trigger', async () => {
    setViewportWidth(1100);
    useSidebar.setState({ isMinimized: false });
    const trigger = makeTrigger();
    await renderHost();
    await act(async () => useDocumentViewer.getState().open(DOC, { trigger }));
    expect(overlay()?.dataset.mode).toBe('sheet');

    const close = overlay()?.querySelector<HTMLButtonElement>(
      '[aria-label="Close document viewer"]',
    );
    await act(async () => close?.click());

    expect(useDocumentViewer.getState().current).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('skips a trigger that has left the document', async () => {
    setViewportWidth(390);
    const trigger = makeTrigger();
    await renderHost();
    await act(async () => useDocumentViewer.getState().open(DOC, { trigger }));
    trigger.remove();
    await pressEscape();
    expect(useDocumentViewer.getState().current).toBeNull();
    expect(document.activeElement).not.toBe(trigger);
  });

  it('above an open ui/dialog, Esc closes only the overlay and focus returns into the modal', async () => {
    let modalOpen = true;
    function Modal(): ReactElement {
      const [open, setOpen] = useState(true);
      modalOpen = open;
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>Edit issue document</DialogTitle>
            <button
              type="button"
              data-testid="modal-trigger"
              onClick={e => useDocumentViewer.getState().open(DOC, { trigger: e.currentTarget })}
            >
              View
            </button>
          </DialogContent>
        </Dialog>
      );
    }
    await renderHost(<Modal />);
    const trigger = document.body.querySelector<HTMLButtonElement>('[data-testid="modal-trigger"]');
    await act(async () => trigger?.click());

    expect(useDocumentViewer.getState().overlayMode).toBe('sheet');
    expect(overlay()).not.toBeNull();
    // Its portal mounts after the modal's, which is how it wins at the same z-index.
    const modalContent = document.body.querySelector('[data-slot="dialog-content"]');
    const position = modalContent?.compareDocumentPosition(overlay() as Node) ?? 0;
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(modalContent?.contains(overlay())).toBe(false);

    await pressEscape();

    expect(overlay()).toBeNull();
    expect(useDocumentViewer.getState().current).toBeNull();
    expect(modalOpen).toBe(true);
    expect(document.body.querySelector('[data-slot="dialog-content"]')).not.toBeNull();
    expect(document.activeElement).toBe(trigger);

    // The next Esc belongs to the modal.
    await pressEscape();
    expect(modalOpen).toBe(false);
  });
});
