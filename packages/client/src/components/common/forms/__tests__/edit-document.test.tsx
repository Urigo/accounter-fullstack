import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentType } from '../../../../gql/graphql.js';
import type { ModifyDocumentFieldsProps } from '../modify-document-fields.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { useQueryMock, updateDocumentMock, toastErrorMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  updateDocumentMock: vi.fn<(variables: unknown) => Promise<unknown>>(),
  toastErrorMock: vi.fn<(title: string, options?: { description?: string }) => void>(),
}));

vi.mock('sonner', () => ({ toast: { error: toastErrorMock } }));

vi.mock('urql', () => ({ useQuery: useQueryMock }));

vi.mock('../../../../hooks/use-update-document.js', () => ({
  useUpdateDocument: () => ({ fetching: false, updateDocument: updateDocumentMock }),
}));

// The real fields pull financial entities and a dozen inputs; one registered field is enough here.
vi.mock('../modify-document-fields.js', () => ({
  ModifyDocumentFields: ({ formManager }: ModifyDocumentFieldsProps): ReactElement => (
    <>
      <input aria-label="Serial" {...formManager.register('serialNumber')} />
      <input
        aria-label="Image URL"
        {...formManager.register('image', { value: 'https://example.com/scan.jpg' })}
      />
    </>
  ),
}));

const { EditDocument, formColumns } = await import('../edit-document.js');
const { resetDocumentViewerStore, useDocumentViewer } = await import(
  '../../../../hooks/use-document-viewer.js'
);

const DOCUMENT = {
  __typename: 'Invoice',
  id: 'doc-1042',
  image: 'https://example.com/scan.jpg',
  file: 'https://example.com/original.pdf',
  documentType: DocumentType.Invoice,
  description: null,
  remarks: null,
  serialNumber: '1042',
  date: '2026-10-03',
  vat: { raw: 180, currency: 'ILS' },
  amount: { raw: 1180, currency: 'ILS' },
  creditor: { id: 'acme', name: 'Acme Ltd' },
  debtor: { id: 'me', name: 'Your Company Ltd' },
  vatReportDateOverride: null,
  noVatAmount: null,
  allocationNumber: null,
  exchangeRateOverride: null,
};

let container: HTMLDivElement;
let root: Root;
const onDone = vi.fn<() => void>();
const onChange = vi.fn<() => void>();

beforeEach(() => {
  resetDocumentViewerStore();
  // Sizes and the hidden pane are remembered in `localStorage`; each test starts from defaults.
  localStorage.clear();
  useQueryMock.mockReturnValue([{ data: { documentById: DOCUMENT }, fetching: false }]);
  updateDocumentMock.mockResolvedValue(undefined);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(min-width: 64rem)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    },
  );
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function render(): void {
  act(() =>
    root.render(
      <MemoryRouter>
        <EditDocument documentId="doc-1042" onDone={onDone} onChange={onChange} />
      </MemoryRouter>,
    ),
  );
}

/** The form's field grid: the `SimpleGrid` holding the fields. */
function grid(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-slot="edit-split-form"] form > .grid');
  if (!el) {
    throw new Error('no grid');
  }
  return el;
}

describe('EditDocument', () => {
  it('shows the document in the embedded viewer, titled from its type and serial', () => {
    render();
    const viewer = container.querySelector('[data-slot="edit-split-viewer"] [data-slot="document-viewer"]');
    expect(viewer?.querySelector('h2')?.textContent).toBe('Tax Invoice 1042');
    expect(viewer?.querySelector('img')?.getAttribute('alt')).toBe('Tax Invoice 1042');
    expect(viewer?.querySelector('img')?.getAttribute('src')).toBe('https://example.com/scan.jpg');
  });

  it('has no thumbnail button and no drawer', () => {
    render();
    expect(container.querySelector('img[alt="Open document scan"]')).toBeNull();
    // The old drawer portaled a second viewer to the body.
    expect(document.body.querySelectorAll('[data-slot="document-viewer"]').length).toBe(1);
    // The Open File cell stays.
    expect(container.textContent).toContain('Open File');
  });

  it('lays the fields out in 2 columns beside the viewer and 4 once it is hidden', () => {
    render();
    expect(grid().className).toContain('min-[601px]:grid-cols-2');
    expect(grid().className).not.toContain('grid-cols-4');

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Hide document"]')?.click());
    expect(grid().className).toContain('min-[981px]:grid-cols-4');

    act(() =>
      container.querySelector<HTMLButtonElement>('[data-slot="edit-split-viewer"] button')?.click(),
    );
    expect(grid().className).not.toContain('grid-cols-4');
  });

  it('a document with nothing attached shows the empty state instead of collapsing', () => {
    useQueryMock.mockReturnValue([
      { data: { documentById: { ...DOCUMENT, image: null, file: null } }, fetching: false },
    ]);
    render();
    expect(container.querySelector('[data-slot="edit-split-viewer"]')?.textContent).toContain(
      'No image or file attached',
    );
  });

  it('shows a spinner while the document loads', () => {
    useQueryMock.mockReturnValue([{ data: undefined, fetching: true }]);
    render();
    expect(container.querySelector('[data-slot="edit-split"]')).toBeNull();
  });

  it('Save closes the sheet and updates in the background', async () => {
    render();
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Serial"]')!;
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, '1043');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = [...container.querySelectorAll('button')].find(b => b.textContent === 'Save');
    expect(save?.disabled).toBe(false);

    await act(async () => {
      save?.click();
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(updateDocumentMock).toHaveBeenCalledWith({
      documentId: 'doc-1042',
      fields: { serialNumber: '1043' },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

function typeInto(label: string, value: string): void {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (!input) {
    throw new Error(`no ${label} input`);
  }
  act(() => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function saveAndNext(): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find(b => b.textContent === 'Save & next');
}

describe('EditDocument Save & next', () => {
  const onNavigate = vi.fn<(id: string) => void>();

  function renderWith(siblingIds: string[] | undefined): void {
    act(() =>
      root.render(
        <MemoryRouter>
          <EditDocument
            documentId="doc-1042"
            onDone={onDone}
            onChange={onChange}
            siblingIds={siblingIds}
            onNavigate={onNavigate}
          />
        </MemoryRouter>,
      ),
    );
  }

  it('is absent without a source list', () => {
    render();
    expect(saveAndNext()).toBeUndefined();
  });

  it('is disabled until something changed', () => {
    renderWith(['doc-1042', 'doc-2']);
    expect(saveAndNext()?.disabled).toBe(true);
    typeInto('Serial', '1043');
    expect(saveAndNext()?.disabled).toBe(false);
  });

  it('is disabled on the last document, and when this one is not in the list', () => {
    renderWith(['doc-1', 'doc-1042']);
    typeInto('Serial', '1043');
    expect(saveAndNext()?.disabled).toBe(true);
    renderWith(['doc-1', 'doc-2']);
    expect(saveAndNext()?.disabled).toBe(true);
  });

  it('awaits the save, then refreshes and moves to the next document', async () => {
    updateDocumentMock.mockResolvedValue({ __typename: 'UpdateDocumentSuccessfulResult' });
    renderWith(['doc-1', 'doc-1042', 'doc-2', 'doc-3']);
    typeInto('Serial', '1043');
    await act(async () => {
      saveAndNext()?.click();
    });
    expect(updateDocumentMock).toHaveBeenCalledWith({
      documentId: 'doc-1042',
      fields: { serialNumber: '1043' },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('doc-2');
    // The sheet stays open: Save & next never calls onDone.
    expect(onDone).not.toHaveBeenCalled();
  });

  it('stays on the document, edits intact, when the save fails', async () => {
    updateDocumentMock.mockResolvedValue(undefined);
    renderWith(['doc-1042', 'doc-2']);
    typeInto('Serial', '1043');
    await act(async () => {
      saveAndNext()?.click();
    });
    expect(updateDocumentMock).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Serial"]')?.value).toBe(
      '1043',
    );
    expect(saveAndNext()?.disabled).toBe(false);
  });

  it('holds both buttons while the save is in flight', async () => {
    let resolveSave: (value: unknown) => void = () => {};
    updateDocumentMock.mockReturnValue(new Promise(resolve => (resolveSave = resolve)));
    renderWith(['doc-1042', 'doc-2']);
    typeInto('Serial', '1043');
    await act(async () => {
      saveAndNext()?.click();
    });
    expect(saveAndNext()?.disabled).toBe(true);
    const save = [...container.querySelectorAll('button')].find(b => b.textContent === 'Save');
    expect(save?.disabled).toBe(true);
    await act(async () => resolveSave({ __typename: 'UpdateDocumentSuccessfulResult' }));
    expect(onNavigate).toHaveBeenCalledWith('doc-2');
  });
});

describe('EditDocument Save & next, review fixes', () => {
  const onNavigate = vi.fn<(id: string) => void>();

  function renderSheet(): void {
    act(() =>
      root.render(
        <MemoryRouter>
          <EditDocument
            documentId="doc-1042"
            onDone={onDone}
            onChange={onChange}
            siblingIds={['doc-1042', 'doc-2']}
            onNavigate={onNavigate}
          />
        </MemoryRouter>,
      ),
    );
  }

  it('does not navigate when the sheet closed while the save was in flight', async () => {
    let resolveSave: (value: unknown) => void = () => {};
    updateDocumentMock.mockReturnValue(new Promise(resolve => (resolveSave = resolve)));
    renderSheet();
    typeInto('Serial', '1043');
    await act(async () => {
      saveAndNext()?.click();
    });
    // The user dismisses the sheet before the network answers.
    act(() => root.render(<></>));
    await act(async () => resolveSave({ __typename: 'UpdateDocumentSuccessfulResult' }));
    expect(onNavigate).not.toHaveBeenCalled();
    // The save did go through, so the list still refreshes.
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('starts one save on a double click', async () => {
    let resolveSave: (value: unknown) => void = () => {};
    updateDocumentMock.mockReturnValue(new Promise(resolve => (resolveSave = resolve)));
    renderSheet();
    typeInto('Serial', '1043');
    const button = saveAndNext();
    await act(async () => {
      // Both clicks land before react-hook-form's async validation re-renders the button.
      button?.click();
      button?.click();
    });
    await act(async () => resolveSave({ __typename: 'UpdateDocumentSuccessfulResult' }));
    expect(updateDocumentMock).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('a throw after the save is caught and releases the buttons', async () => {
    updateDocumentMock.mockResolvedValue({ __typename: 'UpdateDocumentSuccessfulResult' });
    onChange.mockImplementationOnce(() => {
      throw new Error('list refresh failed');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unhandled = vi.fn<(reason: unknown) => void>();
    process.on('unhandledRejection', unhandled);
    try {
      renderSheet();
      typeInto('Serial', '1043');
      await act(async () => {
        saveAndNext()?.click();
      });
      // Let any stray rejection reach the process before checking.
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(unhandled).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('Save & next failed', expect.any(Error));
      // The same error toast the mutation hooks raise.
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Error',
        expect.objectContaining({ description: expect.stringContaining('Save & next failed') }),
      );
      expect(onNavigate).not.toHaveBeenCalled();
      // Released: Save & next is usable again (the edit is still dirty).
      expect(saveAndNext()?.disabled).toBe(false);
    } finally {
      process.off('unhandledRejection', unhandled);
      consoleError.mockRestore();
    }
  });

  it('gives up the keyboard while the viewer pane is hidden', () => {
    renderSheet();
    expect(useDocumentViewer.getState().keyboardOwners).toHaveLength(1);
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Hide document"]')?.click(),
    );
    expect(useDocumentViewer.getState().keyboardOwners).toEqual([]);
  });
});

describe('EditDocument remembered pane and live preview', () => {
  it('remembers a hidden viewer pane across sheets', () => {
    render();
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Hide document"]')?.click(),
    );
    expect(localStorage.getItem('accounter:document-viewer:edit-pane-hidden')).toBe('true');

    act(() => root.render(<></>));
    render();
    expect(container.querySelector('[data-slot="edit-split-viewer"]')?.hasAttribute('data-hidden')).toBe(
      true,
    );
  });

  function viewerImage(): string | null | undefined {
    return container
      .querySelector('[data-slot="edit-split-viewer"] [data-slot="document-viewer-canvas"] img')
      ?.getAttribute('src');
  }

  it('shows a typed http(s) image URL once the field holds still', () => {
    vi.useFakeTimers();
    try {
      render();
      typeInto('Image URL', 'https://example.com/other.jpg');
      act(() => vi.advanceTimersByTime(399));
      expect(viewerImage()).toBe('https://example.com/scan.jpg');
      act(() => vi.advanceTimersByTime(1));
      expect(viewerImage()).toBe('https://example.com/other.jpg');
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ['half-typed', 'https://'],
    ['host still being typed', 'https://exam'],
    ['not a URL', 'scan.jpg'],
    ['another scheme', 'javascript:alert(1)'],
    ['empty', ''],
  ])('keeps the stored image for a %s value', (_, value) => {
    vi.useFakeTimers();
    try {
      render();
      typeInto('Image URL', value);
      act(() => vi.advanceTimersByTime(400));
      expect(viewerImage()).toBe('https://example.com/scan.jpg');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('formColumns', () => {
  it('drops to one column in a narrow pane, whatever the viewer does', () => {
    expect(formColumns(true, false)).toBe(1);
    expect(formColumns(true, true)).toBe(1);
  });

  it('uses two columns beside the viewer and four once it is hidden', () => {
    expect(formColumns(false, false)).toBe(2);
    expect(formColumns(false, true)).toBe(4);
  });
});
