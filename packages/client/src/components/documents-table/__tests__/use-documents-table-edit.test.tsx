import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDocumentsTable } from '../use-documents-table.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useDocumentsTable>;

let container: HTMLDivElement;
let root: Root;
let api: Api;

const DOCUMENTS = ['doc-1', 'doc-2'].map(id => ({
  __typename: 'Invoice',
  id,
  documentType: 'INVOICE',
  image: null,
  file: null,
})) as unknown as Parameters<typeof useDocumentsTable>[0]['documentsProps'];

function Probe(): null {
  api = useDocumentsTable({ documentsProps: DOCUMENTS });
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

function rowEditor(index: number): (siblingIds?: string[]) => void {
  return api.table.getRowModel().rows[index].original.editDocument;
}

describe('useDocumentsTable edit state', () => {
  it('opens the sheet with the row ids and moves it with navigateEditDocument', () => {
    act(() => rowEditor(0)(['doc-1', 'doc-2']));
    expect(api.editDocumentId).toBe('doc-1');
    expect(api.editSiblingIds).toEqual(['doc-1', 'doc-2']);

    act(() => api.navigateEditDocument('doc-2'));
    expect(api.editDocumentId).toBe('doc-2');
    expect(api.editSiblingIds).toEqual(['doc-1', 'doc-2']);
  });

  it('keeps a closed sheet closed when a late Save & next asks to move on', () => {
    act(() => rowEditor(0)(['doc-1', 'doc-2']));
    act(() => api.closeEditDocument());
    act(() => api.navigateEditDocument('doc-2'));
    expect(api.editDocumentId).toBeUndefined();
  });
});
