import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnyTable } from '@/lib/table-features.js';
import { resetDocumentViewerStore, useDocumentViewer } from '@/hooks/use-document-viewer.js';
import {
  buildViewerSiblings,
  getRowIds,
  getStepperPosition,
  neighbourImageUrls,
  useViewerStepper,
  type ViewerSiblingRow,
} from '../siblings.js';
import type { DocumentViewerEntry } from '../types.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type FakeDoc = ViewerSiblingRow & { image: string | null; file: string | null };

/** Only `getRowModel()`, which is all the helpers read. */
function fakeTable(docs: FakeDoc[]): AnyTable<FakeDoc> {
  return {
    getRowModel: () => ({ rows: docs.map(original => ({ id: original.id, original })) }),
  } as unknown as AnyTable<FakeDoc>;
}

const ROWS: FakeDoc[] = [
  { id: 'a', image: 'https://example.com/a.jpg', file: null, serialNumber: '1' },
  { id: 'empty', image: null, file: null, serialNumber: '2' },
  { id: 'file-only', image: null, file: 'https://example.com/c.pdf', serialNumber: '3' },
  { id: 'd', image: ' https://example.com/d.jpg ', file: null, serialNumber: '4' },
];

function entry(id: string, imageUrl: string | null = `https://example.com/${id}.jpg`) {
  return { id, imageUrl, fileUrl: null, title: id } satisfies DocumentViewerEntry;
}

describe('buildViewerSiblings', () => {
  it('maps the rows in table order and leaves out documents with no image and no file', () => {
    const siblings = buildViewerSiblings(fakeTable(ROWS));
    expect(siblings.map(s => s.id)).toEqual(['a', 'file-only', 'd']);
    // Entries are normalized like any viewer entry: trimmed URLs and a title from the labels.
    expect(siblings[2]).toMatchObject({ imageUrl: 'https://example.com/d.jpg', title: 'Document 4' });
  });
});

describe('getRowIds', () => {
  it('keeps every row, documents with no image and no file included', () => {
    expect(getRowIds(fakeTable(ROWS))).toEqual(['a', 'empty', 'file-only', 'd']);
  });
});

describe('getStepperPosition', () => {
  const siblings = ['a', 'b', 'c'].map(id => entry(id));

  it('finds the current document', () => {
    expect(getStepperPosition(siblings, 'b')).toEqual({ index: 1, total: 3 });
  });

  it('is null without siblings, with fewer than two, or when the current one is missing', () => {
    expect(getStepperPosition(null, 'a')).toBeNull();
    expect(getStepperPosition([entry('a')], 'a')).toBeNull();
    expect(getStepperPosition(siblings, 'zzz')).toBeNull();
    expect(getStepperPosition(siblings, null)).toBeNull();
  });
});

describe('neighbourImageUrls', () => {
  it('lists the images either side, skipping those without one', () => {
    const siblings = [entry('a'), entry('b'), entry('c', null), entry('d')];
    expect(neighbourImageUrls(siblings, 'b')).toEqual(['https://example.com/a.jpg']);
    expect(neighbourImageUrls(siblings, 'c')).toEqual([
      'https://example.com/b.jpg',
      'https://example.com/d.jpg',
    ]);
    expect(neighbourImageUrls(siblings, 'a')).toEqual(['https://example.com/b.jpg']);
    expect(neighbourImageUrls(null, 'a')).toEqual([]);
  });
});

describe('useViewerStepper', () => {
  let container: HTMLDivElement;
  let root: Root;
  let preloaded: string[];
  let stepper: ReturnType<typeof useViewerStepper>;

  function Probe({ currentId }: { currentId: string | null }): null {
    stepper = useViewerStepper(currentId);
    return null;
  }

  beforeEach(() => {
    resetDocumentViewerStore();
    preloaded = [];
    vi.stubGlobal(
      'Image',
      class {
        set src(value: string) {
          preloaded.push(value);
        }
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
  });

  it('gives the position and step, and preloads the neighbours on open and on each step', () => {
    const siblings = ['a', 'b', 'c'].map(id => entry(id));
    act(() => useDocumentViewer.getState().open(siblings[0], { siblings }));
    act(() => root.render(<Probe currentId="a" />));
    expect(stepper).toMatchObject({ index: 0, total: 3 });
    expect(preloaded).toEqual(['https://example.com/b.jpg']);

    act(() => stepper?.onStep(1));
    act(() => root.render(<Probe currentId={useDocumentViewer.getState().current?.id ?? null} />));
    expect(stepper).toMatchObject({ index: 1, total: 3 });
    expect(preloaded).toEqual([
      'https://example.com/b.jpg',
      'https://example.com/a.jpg',
      'https://example.com/c.jpg',
    ]);
  });

  it('gives nothing, and preloads nothing, for a closed viewer', () => {
    const siblings = ['a', 'b'].map(id => entry(id));
    act(() => useDocumentViewer.getState().open(siblings[0], { siblings }));
    act(() => root.render(<Probe currentId={null} />));
    expect(stepper).toBeUndefined();
    expect(preloaded).toEqual([]);
  });
});
