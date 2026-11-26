import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Row } from '@tanstack/react-table';
import type { AnyTable, TableFeaturesConfig } from '@/lib/table-features.js';
import {
  getViewerTrigger,
  resetDocumentViewerStore,
  useDocumentViewer,
} from '../../../hooks/use-document-viewer.js';
import { Files } from '../cells/files.js';
import { Preview } from '../cells/preview.js';
import type { DocumentsTableRowType } from '../columns.js';
import { DocumentsTableRow, useReconcileViewerRows } from '../data-table.js';

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
function fakeRow(id: string, selected = false): Row<TableFeaturesConfig, { id: string }> {
  return {
    id,
    original: { id },
    getIsSelected: () => selected,
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

  it('keeps the highlight on a row that is also selected', () => {
    render(
      <table>
        <tbody>
          <DocumentsTableRow row={fakeRow('doc-1', true)} />
        </tbody>
      </table>,
    );
    expect(rowFor(0).getAttribute('data-state')).toBe('selected');
    expect(rowFor(0).className).toContain('data-[state=selected]:bg-gray-100');

    act(() =>
      useDocumentViewer
        .getState()
        .open({ id: 'doc-1', imageUrl: 'https://example.com/a.jpg', fileUrl: null, title: 'A' }),
    );
    const classes = rowFor(0).className.split(/\s+/);
    expect(classes).toContain('data-[state=selected]:bg-blue-50');
    expect(classes).toContain('dark:data-[state=selected]:bg-blue-950/40');
    expect(classes).not.toContain('data-[state=selected]:bg-gray-100');
    expect(classes).not.toContain('dark:data-[state=selected]:bg-gray-800');
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

/** Only `getRowModel()`, which the sibling helpers read. */
function fakeTable(docs: DocumentsTableRowType[]): AnyTable<DocumentsTableRowType> {
  return {
    getRowModel: () => ({ rows: docs.map(original => ({ id: original.id, original })) }),
  } as unknown as AnyTable<DocumentsTableRowType>;
}

describe.each([
  ['Preview', Preview],
  ['Files', Files],
])('%s cell siblings', (_, Cell) => {
  it('opens with the table rows as siblings, leaving out those with nothing attached', () => {
    const docs = [makeDocument('doc-1'), makeDocument('doc-empty', null), makeDocument('doc-3')];
    render(<Cell document={docs[0]} table={fakeTable(docs)} />);
    act(() => imageButton().click());
    expect(useDocumentViewer.getState().siblings?.map(s => s.id)).toEqual(['doc-1', 'doc-3']);
  });

  it('opens with no siblings outside a table', () => {
    render(<Cell document={makeDocument('doc-1')} />);
    act(() => imageButton().click());
    expect(useDocumentViewer.getState().siblings).toBeNull();
  });
});

describe('useReconcileViewerRows', () => {
  function Rows({ ids }: { ids: string[] }): null {
    useReconcileViewerRows(ids);
    return null;
  }

  const entry = (id: string) => ({
    id,
    imageUrl: `https://example.com/${id}.jpg`,
    fileUrl: null,
    title: id,
  });

  it('drops the siblings when the current document leaves the rows, not on first render', () => {
    const siblings = ['a', 'b', 'c'].map(entry);
    act(() => useDocumentViewer.getState().open(siblings[1], { siblings }));
    render(<Rows ids={['x', 'y']} />);
    // First render only records: another table mounting must not drop our snapshot.
    expect(useDocumentViewer.getState().siblings).toHaveLength(3);

    render(<Rows ids={['a', 'b', 'c']} />);
    render(<Rows ids={['c', 'b', 'a']} />);
    expect(useDocumentViewer.getState().siblings).toHaveLength(3);

    render(<Rows ids={['c', 'a']} />);
    expect(useDocumentViewer.getState().siblings).toBeNull();
  });

  function NullableRows({ ids }: { ids: string[] | null }): null {
    useReconcileViewerRows(ids);
    return null;
  }

  it('skips null (a refetch in flight) without reading it as emptied rows', () => {
    const siblings = ['a', 'b', 'c'].map(entry);
    act(() => useDocumentViewer.getState().open(siblings[1], { siblings }));
    render(<NullableRows ids={['a', 'b', 'c']} />);
    render(<NullableRows ids={null} />);
    // The same result comes back: nothing to drop.
    render(<NullableRows ids={['a', 'b', 'c']} />);
    expect(useDocumentViewer.getState().siblings).toHaveLength(3);

    render(<NullableRows ids={null} />);
    // A refetch without the current document is compared with the ids from before it.
    render(<NullableRows ids={['a', 'c']} />);
    expect(useDocumentViewer.getState().siblings).toBeNull();
  });

  /**
   * The all-documents screen: the table (which reconciles too) is swapped for a spinner while
   * fetching, and the always-mounted screen reconciles with `null` meanwhile.
   */
  function Screen({ fetching, ids }: { fetching: boolean; ids: string[] }): ReactElement {
    useReconcileViewerRows(fetching ? null : ids);
    return fetching ? <p>Loading</p> : <Rows ids={ids} />;
  }

  it('reconciles across a table that unmounts while its screen refetches', () => {
    const siblings = ['a', 'b', 'c'].map(entry);
    act(() => useDocumentViewer.getState().open(siblings[1], { siblings }));
    render(<Screen fetching={false} ids={['a', 'b', 'c']} />);
    // A delete or a filter change: the screen refetches, the table unmounts...
    render(<Screen fetching ids={['a', 'b', 'c']} />);
    expect(useDocumentViewer.getState().siblings).toHaveLength(3);
    // ...and remounts without the current document. Its own first render only records; the
    // screen's hook still remembers the ids from before the fetch.
    render(<Screen fetching={false} ids={['a', 'c']} />);
    expect(useDocumentViewer.getState().siblings).toBeNull();
  });
});
