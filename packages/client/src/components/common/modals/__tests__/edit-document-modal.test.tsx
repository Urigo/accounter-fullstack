import { act, useEffect, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDocumentViewerStore, useDocumentViewer } from '../../../../hooks/use-document-viewer.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mounts } = vi.hoisted(() => ({ mounts: [] as string[] }));

// The real drawer, so the sheet's size classes are what ships; stubs for the rest of the barrel.
vi.mock('../../index.js', async () => {
  const { PopUpDrawer } = await vi.importActual<typeof import('../drawer.js')>('../drawer.js');
  return {
    PopUpDrawer,
    Tooltip: ({ children }: { children: ReactNode }): ReactNode => children,
    CopyToClipboardButton: (): null => null,
    UnlinkDocumentButton: (): null => null,
    DeleteDocumentButton: (): null => null,
    EditDocument: function EditDocumentStub({ documentId }: { documentId: string }): ReactElement {
      useEffect(() => {
        mounts.push(documentId);
      }, [documentId]);
      return <div data-testid="edit-document">{documentId}</div>;
    },
  };
});

const { EditDocumentModal } = await import('../edit-document-modal.js');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetDocumentViewerStore();
  mounts.length = 0;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

function render(documentId?: string): void {
  act(() =>
    root.render(<EditDocumentModal documentId={documentId} onDone={() => {}} onChange={() => {}} />),
  );
}

describe('EditDocumentModal', () => {
  it('opens as the tall sheet', () => {
    render('doc-1');
    const content = document.body.querySelector('[data-slot="drawer-content"]');
    expect(content?.className).toContain('data-[vaul-drawer-direction=bottom]:h-[90vh]');
    expect(content?.className).toContain('data-[vaul-drawer-direction=bottom]:max-h-[90vh]');
    // tailwind-merge drops the house cap, since the prefixes match.
    expect(content?.className).not.toContain('data-[vaul-drawer-direction=bottom]:max-h-[80vh]');
  });

  it('suspends the docked viewer while open and resumes on close', () => {
    render();
    expect(useDocumentViewer.getState().suspendCount).toBe(0);
    render('doc-1');
    expect(useDocumentViewer.getState().suspendCount).toBe(1);
    render('doc-2');
    expect(useDocumentViewer.getState().suspendCount).toBe(1);
    render();
    expect(useDocumentViewer.getState().suspendCount).toBe(0);
  });

  it('leaves the default bottom sheet at the house height', async () => {
    const { PopUpDrawer } = await import('../drawer.js');
    act(() =>
      root.render(
        <PopUpDrawer position="bottom" opened>
          <div>body</div>
        </PopUpDrawer>,
      ),
    );
    const content = document.body.querySelector('[data-slot="drawer-content"]');
    expect(content?.className).toContain('data-[vaul-drawer-direction=bottom]:max-h-[80vh]');
    expect(content?.className).not.toContain('h-[90vh]');
  });

  it('stays open on an Esc that something inside already handled, and closes otherwise', async () => {
    const { PopUpDrawer } = await import('../drawer.js');
    const onClose = vi.fn<() => void>();
    act(() =>
      root.render(
        <PopUpDrawer position="bottom" opened onClose={onClose}>
          <button type="button">inside</button>
        </PopUpDrawer>,
      ),
    );
    const inside = [...document.body.querySelectorAll('button')].find(
      b => b.textContent === 'inside',
    )!;
    const escape = (): void => {
      act(() => {
        inside.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
        );
      });
    };

    // Handled first, as the edit split does for its expanded viewer (without stopping it).
    const handle = (event: KeyboardEvent): void => event.preventDefault();
    window.addEventListener('keydown', handle, { capture: true });
    escape();
    window.removeEventListener('keydown', handle, { capture: true });
    expect(onClose).not.toHaveBeenCalled();

    escape();
    expect(onClose).toHaveBeenCalled();
  });

  it('remounts the form for another document', () => {
    render('doc-1');
    render('doc-2');
    expect(mounts).toEqual(['doc-1', 'doc-2']);
    expect(document.body.querySelectorAll('[data-testid="edit-document"]').length).toBe(1);
  });
});
