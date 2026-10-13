import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentType } from '../../../../gql/graphql.js';
import type { ModifyDocumentFieldsProps } from '../modify-document-fields.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { useQueryMock, updateDocumentMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  updateDocumentMock: vi.fn<(variables: unknown) => Promise<void>>(),
}));

vi.mock('urql', () => ({ useQuery: useQueryMock }));

vi.mock('../../../../hooks/use-update-document.js', () => ({
  useUpdateDocument: () => ({ fetching: false, updateDocument: updateDocumentMock }),
}));

// The real fields pull financial entities and a dozen inputs; one registered field is enough here.
vi.mock('../modify-document-fields.js', () => ({
  ModifyDocumentFields: ({ formManager }: ModifyDocumentFieldsProps): ReactElement => (
    <input aria-label="Serial" {...formManager.register('serialNumber')} />
  ),
}));

const { EditDocument } = await import('../edit-document.js');

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
  useQueryMock.mockReturnValue([{ data: { documentById: DOCUMENT }, fetching: false }]);
  updateDocumentMock.mockResolvedValue(undefined);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(min-width: 1024px)',
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
