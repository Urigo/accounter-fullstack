import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getViewerTrigger,
  resetDocumentViewerStore,
  useDocumentViewer,
} from '../../../hooks/use-document-viewer.js';
import { useSidebar } from '../../../hooks/use-sidebar.js';
import type { DocumentsTableRowType } from '../columns.js';
import { DocumentActionsMenu } from '../document-actions-menu.js';

const deleteDocument = vi.fn<(input: { documentId: string }) => Promise<unknown>>();

// The menu mounts every action's modal; none of them may reach a real GraphQL client.
vi.mock('urql', () => ({
  useMutation: () => [{ fetching: false }, vi.fn()],
  useQuery: () => [{ data: undefined, fetching: false }, vi.fn()],
  useClient: () => ({}),
}));
vi.mock('../../../hooks/use-delete-document.js', () => ({
  useDeleteDocument: () => ({ deleteDocument, fetching: false }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeDocument(image = 'https://example.com/doc-1.jpg'): DocumentsTableRowType {
  return {
    __typename: 'Invoice',
    id: 'doc-1',
    documentType: 'INVOICE',
    image,
    file: null,
    serialNumber: '1042',
    creditor: null,
    debtor: null,
    charge: null,
    editDocument: () => {},
    onUpdate: () => {},
  } as unknown as DocumentsTableRowType;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetDocumentViewerStore();
  useSidebar.setState({ isMinimized: true });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 1440,
  });
  deleteDocument.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

function render(ui: ReactElement): void {
  act(() => root.render(<MemoryRouter>{ui}</MemoryRouter>));
}

function menuTrigger(): HTMLButtonElement {
  const button = document.body.querySelector<HTMLButtonElement>(
    'button[aria-label="Document actions"]',
  );
  if (!button) {
    throw new Error('menu trigger not rendered');
  }
  return button;
}

/** Radix opens the menu on a primary-button pointerdown and portals the items to the body. */
function selectItem(label: string): void {
  act(() => {
    menuTrigger().dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
    );
  });
  const item = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    el => el.textContent?.trim() === label,
  );
  if (!item) {
    throw new Error(`menu item "${label}" not found`);
  }
  act(() => item.click());
}

describe('DocumentActionsMenu', () => {
  it('View Image opens the docked viewer with the menu button as trigger', () => {
    render(<DocumentActionsMenu document={makeDocument()} />);
    selectItem('View Image');

    const state = useDocumentViewer.getState();
    expect(state.current?.id).toBe('doc-1');
    expect(state.current?.title).toBe('Tax Invoice 1042');
    expect(state.placement).toBe('docked');
    // Not the portaled menu item, which can never sit inside a dialog.
    expect(getViewerTrigger()).toBe(menuTrigger());
  });

  it('View Image falls back to the drawer when the menu sits inside a dialog', () => {
    render(
      <div role="dialog">
        <DocumentActionsMenu document={makeDocument()} />
      </div>,
    );
    selectItem('View Image');

    expect(useDocumentViewer.getState().placement).toBe('fallback');
    expect(getViewerTrigger()).toBe(menuTrigger());
  });

  it('syncs a refreshed row into the open viewer', () => {
    render(<DocumentActionsMenu document={makeDocument()} />);
    selectItem('View Image');

    render(<DocumentActionsMenu document={makeDocument('https://example.com/doc-1-v2.jpg')} />);
    expect(useDocumentViewer.getState().current?.imageUrl).toBe(
      'https://example.com/doc-1-v2.jpg',
    );
  });

  it('does not sync into a viewer showing another document', () => {
    const other = { id: 'doc-2', imageUrl: 'https://example.com/b.jpg', fileUrl: null, title: 'B' };
    act(() => useDocumentViewer.getState().open(other));
    render(<DocumentActionsMenu document={makeDocument('https://example.com/doc-1-v2.jpg')} />);
    expect(useDocumentViewer.getState().current).toEqual(other);
  });

  async function deleteThroughMenu(): Promise<void> {
    selectItem('Delete Document');
    const confirm = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
      el => el.textContent?.trim() === 'Confirm',
    );
    if (!confirm) {
      throw new Error('confirmation not rendered');
    }
    await act(async () => confirm.click());
  }

  it('closes the viewer when its document is deleted', async () => {
    deleteDocument.mockResolvedValue({ deletedChargeId: null });
    render(<DocumentActionsMenu document={makeDocument()} />);
    selectItem('View Image');

    await deleteThroughMenu();
    expect(deleteDocument).toHaveBeenCalledWith({ documentId: 'doc-1' });
    expect(useDocumentViewer.getState().current).toBeNull();
  });

  it('keeps the viewer open when another document is deleted', async () => {
    deleteDocument.mockResolvedValue({ deletedChargeId: null });
    const other = { id: 'doc-2', imageUrl: 'https://example.com/b.jpg', fileUrl: null, title: 'B' };
    act(() => useDocumentViewer.getState().open(other));
    render(<DocumentActionsMenu document={makeDocument()} />);

    await deleteThroughMenu();
    expect(useDocumentViewer.getState().current).toEqual(other);
  });

  it('keeps the viewer open when the delete fails', async () => {
    deleteDocument.mockResolvedValue(undefined);
    render(<DocumentActionsMenu document={makeDocument()} />);
    selectItem('View Image');

    await deleteThroughMenu();
    expect(useDocumentViewer.getState().current?.id).toBe('doc-1');
  });
});
