import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Row } from '@tanstack/react-table';
import type { TableFeaturesConfig } from '@/lib/table-features.js';
import {
  getViewerTrigger,
  resetDocumentViewerStore,
  useDocumentViewer,
} from '../../../hooks/use-document-viewer.js';
import { Files } from '../cells/files.js';
import { Preview } from '../cells/preview.js';
import type { DocumentsTableRowType } from '../columns.js';
import { DocumentsTableRow } from '../data-table.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeDocument(id: string, image: string | null = `https://example.com/${id}.jpg`) {
  return {
    __typename: 'Invoice',
    id,
    documentType: 'INVOICE',
    image,
    file: null,
    serialNumber: '1042',
    creditor: { id: 'c', name: 'Acme Ltd' },
    debtor: null,
    editDocument: () => {},
    onUpdate: () => {},
  } as unknown as DocumentsTableRowType;
}

/** Only what `DocumentsTableRow` touches. */
function fakeRow(id: string): Row<TableFeaturesConfig, { id: string }> {
  return {
    id,
    original: { id },
    getIsSelected: () => false,
    getVisibleCells: () => [],
  } as unknown as Row<TableFeaturesConfig, { id: string }>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetDocumentViewerStore();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

function render(ui: ReactElement): void {
  act(() => root.render(ui));
}

function imageButton(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Open document image"]',
  );
  if (!button) {
    throw new Error('no image button');
  }
  return button;
}

describe.each([
  ['Preview', Preview],
  ['Files', Files],
])('%s cell', (_, Cell) => {
  it('opens the shared viewer with the clicked button as trigger', () => {
    render(<Cell document={makeDocument('doc-1')} />);
    expect(imageButton().getAttribute('aria-expanded')).toBe('false');

    act(() => imageButton().click());
    const { current } = useDocumentViewer.getState();
    expect(current?.id).toBe('doc-1');
    expect(current?.imageUrl).toBe('https://example.com/doc-1.jpg');
    expect(current?.title).toBe('Tax Invoice 1042');
    expect(getViewerTrigger()).toBe(imageButton());
    expect(imageButton().getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the viewer when clicked while its document is shown', () => {
    render(<Cell document={makeDocument('doc-1')} />);
    act(() => imageButton().click());
    act(() => imageButton().click());
    expect(useDocumentViewer.getState().current).toBeNull();
    expect(imageButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('is not expanded while another document is shown', () => {
    render(<Cell document={makeDocument('doc-1')} />);
    act(() =>
      useDocumentViewer
        .getState()
        .open({ id: 'doc-2', imageUrl: 'https://example.com/b.jpg', fileUrl: null, title: 'B' }),
    );
    expect(imageButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('mounts no drawer of its own', () => {
    render(<Cell document={makeDocument('doc-1')} />);
    act(() => imageButton().click());
    expect(document.querySelector('[data-slot="document-viewer"]')).toBeNull();
  });
});

describe('DocumentsTableRow', () => {
  function renderRows(): void {
    render(
      <table>
        <tbody>
          <DocumentsTableRow row={fakeRow('doc-1')} className="bg-blue-100" />
          <DocumentsTableRow row={fakeRow('doc-2')} />
        </tbody>
      </table>,
    );
  }

  function rowFor(index: number): HTMLTableRowElement {
    return container.querySelectorAll('tr')[index] as HTMLTableRowElement;
  }

  it('highlights the row whose document is open', () => {
    renderRows();
    expect(rowFor(0).hasAttribute('data-viewing')).toBe(false);
    expect(rowFor(0).className).toContain('bg-blue-100');

    act(() =>
      useDocumentViewer
        .getState()
        .open({ id: 'doc-1', imageUrl: 'https://example.com/a.jpg', fileUrl: null, title: 'A' }),
    );
    expect(rowFor(0).hasAttribute('data-viewing')).toBe(true);
    expect(rowFor(0).className).toContain('bg-blue-50');
    expect(rowFor(0).className).not.toContain('bg-blue-100');
    expect(rowFor(1).hasAttribute('data-viewing')).toBe(false);
    // Selection keeps `data-state` to itself.
    expect(rowFor(0).getAttribute('data-state')).toBeNull();
  });

  it('moves the highlight on a swap', () => {
    renderRows();
    const { open } = useDocumentViewer.getState();
    act(() => open({ id: 'doc-1', imageUrl: null, fileUrl: 'https://e.com/a.pdf', title: 'A' }));
    act(() => open({ id: 'doc-2', imageUrl: null, fileUrl: 'https://e.com/b.pdf', title: 'B' }));
    expect(rowFor(0).hasAttribute('data-viewing')).toBe(false);
    expect(rowFor(1).hasAttribute('data-viewing')).toBe(true);
  });
});
