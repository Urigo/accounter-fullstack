import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DocumentViewerEntry } from '../../components/common/document-viewer/types.js';
import {
  getTopKeyboardOwnerId,
  getViewerTrigger,
  KEYBOARD_RANK,
  resetDocumentViewerStore,
  useDocumentViewer,
} from '../use-document-viewer.js';
import { useSidebar } from '../use-sidebar.js';

const DOC_A: DocumentViewerEntry = {
  id: 'doc-a',
  imageUrl: 'https://example.com/a.jpg',
  fileUrl: null,
  title: 'Tax Invoice 1042',
};
const DOC_B: DocumentViewerEntry = {
  id: 'doc-b',
  imageUrl: 'https://example.com/b.jpg',
  fileUrl: 'https://example.com/b.pdf',
  title: 'Receipt 7',
};

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
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useDocumentViewer', () => {
  it('starts closed', () => {
    const { current, placement, overlayMode, expanded } = useDocumentViewer.getState();
    expect({ current, placement, overlayMode, expanded }).toEqual({
      current: null,
      placement: null,
      overlayMode: null,
      expanded: false,
    });
  });

  it('opens docked on a wide screen', () => {
    useDocumentViewer.getState().open(DOC_A);
    expect(useDocumentViewer.getState().current).toEqual(DOC_A);
    expect(useDocumentViewer.getState().placement).toBe('docked');
    expect(useDocumentViewer.getState().overlayMode).toBeNull();
  });

  it('re-resolves the overlay mode on each open, and close() clears it', () => {
    setViewportWidth(800);
    useDocumentViewer.getState().open(DOC_A);
    expect(useDocumentViewer.getState().overlayMode).toBe('fullscreen');

    setViewportWidth(1440);
    useDocumentViewer.getState().open(DOC_B);
    expect(useDocumentViewer.getState()).toMatchObject({ placement: 'docked', overlayMode: null });

    useDocumentViewer.getState().close();
    expect(useDocumentViewer.getState().overlayMode).toBeNull();
  });

  it('swaps in place instead of stacking', () => {
    const { open } = useDocumentViewer.getState();
    open(DOC_A);
    useDocumentViewer.getState().setExpanded(true);
    open(DOC_B);
    expect(useDocumentViewer.getState().current).toEqual(DOC_B);
    // A swap inside the docked column keeps it expanded.
    expect(useDocumentViewer.getState().expanded).toBe(true);
  });

  it('uses the fullscreen overlay on a narrow screen', () => {
    setViewportWidth(800);
    useDocumentViewer.getState().open(DOC_A);
    expect(useDocumentViewer.getState()).toMatchObject({ placement: 'overlay', overlayMode: 'fullscreen' });
  });

  it('uses the overlay sheet when the trigger sits inside a dialog', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.append(button);
    document.body.append(dialog);

    useDocumentViewer.getState().open(DOC_A, { trigger: button });
    expect(useDocumentViewer.getState()).toMatchObject({ placement: 'overlay', overlayMode: 'sheet' });
  });

  it('reads the sidebar width at open time', () => {
    setViewportWidth(1100);
    useSidebar.setState({ isMinimized: false });
    useDocumentViewer.getState().open(DOC_A);
    expect(useDocumentViewer.getState()).toMatchObject({ placement: 'overlay', overlayMode: 'sheet' });

    useSidebar.setState({ isMinimized: true });
    useDocumentViewer.getState().open(DOC_B);
    expect(useDocumentViewer.getState().placement).toBe('docked');
  });

  it('toggle opens, swaps, and closes on the shown document', () => {
    const { toggle } = useDocumentViewer.getState();
    toggle(DOC_A);
    expect(useDocumentViewer.getState().current?.id).toBe('doc-a');
    toggle(DOC_B);
    expect(useDocumentViewer.getState().current?.id).toBe('doc-b');
    toggle(DOC_B);
    expect(useDocumentViewer.getState().current).toBeNull();
    expect(useDocumentViewer.getState().placement).toBeNull();
  });

  it('update refreshes the shown document only', () => {
    useDocumentViewer.getState().open(DOC_A);
    const before = useDocumentViewer.getState().current;

    useDocumentViewer.getState().update({ ...DOC_B, title: 'Other' });
    expect(useDocumentViewer.getState().current).toBe(before);

    // An unchanged entry keeps the same object, so subscribers don't re-render.
    useDocumentViewer.getState().update({ ...DOC_A });
    expect(useDocumentViewer.getState().current).toBe(before);

    const edited = { ...DOC_A, imageUrl: 'https://example.com/a-v2.jpg', title: 'Invoice 1042' };
    useDocumentViewer.getState().update(edited);
    expect(useDocumentViewer.getState().current).toEqual(edited);
  });

  it('update does nothing while closed', () => {
    useDocumentViewer.getState().update(DOC_A);
    expect(useDocumentViewer.getState().current).toBeNull();
  });

  it('close resets expanded', () => {
    useDocumentViewer.getState().open(DOC_A);
    useDocumentViewer.getState().setExpanded(true);
    useDocumentViewer.getState().close();
    expect(useDocumentViewer.getState().expanded).toBe(false);
    useDocumentViewer.getState().open(DOC_A);
    expect(useDocumentViewer.getState().expanded).toBe(false);
  });

  it('keeps the trigger outside store state', () => {
    const button = document.createElement('button');
    document.body.append(button);
    useDocumentViewer.getState().open(DOC_A, { trigger: button });

    expect(getViewerTrigger()).toBe(button);
    const values = Object.values(useDocumentViewer.getState());
    expect(values).not.toContain(button);
    expect(JSON.stringify(useDocumentViewer.getState())).not.toContain('button');

    useDocumentViewer.getState().close();
    expect(getViewerTrigger()).toBeNull();
  });

  it('a swap without a trigger forgets the previous one', () => {
    const button = document.createElement('button');
    useDocumentViewer.getState().open(DOC_A, { trigger: button });
    useDocumentViewer.getState().open(DOC_B);
    expect(getViewerTrigger()).toBeNull();
  });

  it('resetDocumentViewerStore clears everything', () => {
    useDocumentViewer.getState().open(DOC_A, { trigger: document.createElement('button') });
    useDocumentViewer.getState().suspend();
    resetDocumentViewerStore();
    expect(useDocumentViewer.getState().current).toBeNull();
    expect(useDocumentViewer.getState().suspendCount).toBe(0);
    expect(getViewerTrigger()).toBeNull();
  });
});

describe('useDocumentViewer suspend', () => {
  it('counts suspensions and resumes', () => {
    const resumeA = useDocumentViewer.getState().suspend();
    const resumeB = useDocumentViewer.getState().suspend();
    expect(useDocumentViewer.getState().suspendCount).toBe(2);
    resumeA();
    expect(useDocumentViewer.getState().suspendCount).toBe(1);
    resumeB();
    expect(useDocumentViewer.getState().suspendCount).toBe(0);
  });

  it('a resume function is idempotent', () => {
    const resumeA = useDocumentViewer.getState().suspend();
    useDocumentViewer.getState().suspend();
    resumeA();
    resumeA();
    expect(useDocumentViewer.getState().suspendCount).toBe(1);
  });

  it('keeps the open document while suspended, and close() leaves the count alone', () => {
    useDocumentViewer.getState().open(DOC_A);
    const resume = useDocumentViewer.getState().suspend();
    expect(useDocumentViewer.getState().current?.id).toBe('doc-a');
    expect(useDocumentViewer.getState().placement).toBe('docked');

    useDocumentViewer.getState().close();
    expect(useDocumentViewer.getState().suspendCount).toBe(1);
    resume();
    expect(useDocumentViewer.getState().suspendCount).toBe(0);
  });
});

function doc(id: string): DocumentViewerEntry {
  return { id, imageUrl: `https://example.com/${id}.jpg`, fileUrl: null, title: id };
}

const SIBLINGS = ['s1', 's2', 's3'].map(doc);

describe('useDocumentViewer siblings', () => {
  it('opens with a snapshot that later changes to the source list do not reach', () => {
    const source = [...SIBLINGS];
    useDocumentViewer.getState().open(SIBLINGS[1], { siblings: source });
    source.reverse();
    source.push(doc('s4'));
    expect(useDocumentViewer.getState().siblings?.map(s => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('opens without siblings when none are passed, and close() drops them', () => {
    useDocumentViewer.getState().open(SIBLINGS[0], { siblings: SIBLINGS });
    useDocumentViewer.getState().open(DOC_A);
    expect(useDocumentViewer.getState().siblings).toBeNull();

    useDocumentViewer.getState().open(SIBLINGS[0], { siblings: SIBLINGS });
    useDocumentViewer.getState().close();
    expect(useDocumentViewer.getState().siblings).toBeNull();
  });

  it('steps within bounds, with no wrap-around', () => {
    const { open, step } = useDocumentViewer.getState();
    open(SIBLINGS[0], { siblings: SIBLINGS });
    step(-1);
    expect(useDocumentViewer.getState().current?.id).toBe('s1');
    step(1);
    step(1);
    expect(useDocumentViewer.getState().current?.id).toBe('s3');
    step(1);
    expect(useDocumentViewer.getState().current?.id).toBe('s3');
    step(-1);
    expect(useDocumentViewer.getState().current?.id).toBe('s2');
  });

  it('steps without re-resolving the placement or collapsing an expanded column', () => {
    const { open, step, setExpanded } = useDocumentViewer.getState();
    open(SIBLINGS[0], { siblings: SIBLINGS });
    setExpanded(true);
    // Placement is decided at open time only: a narrower window now changes nothing.
    setViewportWidth(800);
    step(1);
    const state = useDocumentViewer.getState();
    expect(state.current?.id).toBe('s2');
    expect(state.placement).toBe('docked');
    expect(state.expanded).toBe(true);
  });

  it('does nothing without siblings, or when the current document is not among them', () => {
    const { open, step } = useDocumentViewer.getState();
    open(DOC_A);
    step(1);
    expect(useDocumentViewer.getState().current?.id).toBe('doc-a');
    open(DOC_A, { siblings: SIBLINGS });
    step(1);
    expect(useDocumentViewer.getState().current?.id).toBe('doc-a');
  });

  it('reconcile drops the siblings once the current document leaves its table', () => {
    const { open, reconcileRowIds } = useDocumentViewer.getState();
    open(SIBLINGS[1], { siblings: SIBLINGS });
    // Another table on the page changed: not ours.
    reconcileRowIds(['x1', 'x2'], ['x1']);
    // Ours was re-sorted: the current document is still there.
    reconcileRowIds(['s1', 's2', 's3'], ['s3', 's2', 's1']);
    expect(useDocumentViewer.getState().siblings).toHaveLength(3);

    reconcileRowIds(['s3', 's2', 's1'], ['s3', 's1']);
    expect(useDocumentViewer.getState().siblings).toBeNull();
    // The document itself stays open; only the stepper goes.
    expect(useDocumentViewer.getState().current?.id).toBe('s2');
  });

  it('update() refreshes the snapshot copy too', () => {
    const { open, update, step } = useDocumentViewer.getState();
    open(SIBLINGS[0], { siblings: SIBLINGS });
    update({ ...SIBLINGS[0], title: 'Edited' });
    step(1);
    step(-1);
    expect(useDocumentViewer.getState().current?.title).toBe('Edited');
  });
});

describe('useDocumentViewer keyboard owners', () => {
  it('the top owner is the highest rank, the latest one on a tie', () => {
    expect(getTopKeyboardOwnerId([])).toBeNull();
    expect(
      getTopKeyboardOwnerId([
        { id: 'docked', rank: KEYBOARD_RANK.docked },
        { id: 'overlay', rank: KEYBOARD_RANK.overlay },
        { id: 'embedded', rank: KEYBOARD_RANK.embedded },
      ]),
    ).toBe('overlay');
    expect(
      getTopKeyboardOwnerId([
        { id: 'first', rank: KEYBOARD_RANK.embedded },
        { id: 'second', rank: KEYBOARD_RANK.embedded },
      ]),
    ).toBe('second');
  });

  it('registers and unregisters owners; unregistering twice is a no-op', () => {
    const { registerKeyboardOwner } = useDocumentViewer.getState();
    const removeDocked = registerKeyboardOwner('docked', KEYBOARD_RANK.docked);
    const removeEmbedded = registerKeyboardOwner('embedded', KEYBOARD_RANK.embedded);
    expect(getTopKeyboardOwnerId(useDocumentViewer.getState().keyboardOwners)).toBe('embedded');

    removeEmbedded();
    removeEmbedded();
    expect(useDocumentViewer.getState().keyboardOwners).toEqual([
      { id: 'docked', rank: KEYBOARD_RANK.docked },
    ]);
    removeDocked();
    expect(useDocumentViewer.getState().keyboardOwners).toEqual([]);
  });

  it('close() keeps the owners: they belong to the mounted viewers', () => {
    useDocumentViewer.getState().registerKeyboardOwner('docked', KEYBOARD_RANK.docked);
    useDocumentViewer.getState().open(DOC_A);
    useDocumentViewer.getState().close();
    expect(useDocumentViewer.getState().keyboardOwners).toHaveLength(1);
  });
});
