import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DocumentViewerEntry } from '../../components/common/document-viewer/types.js';
import {
  getViewerTrigger,
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
    const { current, placement, expanded } = useDocumentViewer.getState();
    expect({ current, placement, expanded }).toEqual({
      current: null,
      placement: null,
      expanded: false,
    });
  });

  it('opens docked on a wide screen', () => {
    useDocumentViewer.getState().open(DOC_A);
    expect(useDocumentViewer.getState().current).toEqual(DOC_A);
    expect(useDocumentViewer.getState().placement).toBe('docked');
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

  it('falls back on a narrow screen', () => {
    setViewportWidth(800);
    useDocumentViewer.getState().open(DOC_A);
    expect(useDocumentViewer.getState().placement).toBe('fallback');
  });

  it('falls back when the trigger sits inside a dialog', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.append(button);
    document.body.append(dialog);

    useDocumentViewer.getState().open(DOC_A, { trigger: button });
    expect(useDocumentViewer.getState().placement).toBe('fallback');
  });

  it('reads the sidebar width at open time', () => {
    setViewportWidth(1100);
    useSidebar.setState({ isMinimized: false });
    useDocumentViewer.getState().open(DOC_A);
    expect(useDocumentViewer.getState().placement).toBe('fallback');

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
