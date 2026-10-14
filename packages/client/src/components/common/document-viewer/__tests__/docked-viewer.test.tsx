import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDocumentViewerStore, useDocumentViewer } from '../../../../hooks/use-document-viewer.js';
import { useSidebar } from '../../../../hooks/use-sidebar.js';
import { DOCKED_WIDTH_VAR, DockedDocumentViewer } from '../docked-viewer.js';
import type { DocumentViewerEntry } from '../types.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOC: DocumentViewerEntry = {
  id: 'doc-1',
  imageUrl: 'https://example.com/scan.jpg',
  fileUrl: null,
  title: 'Tax Invoice 1042',
};

/** The work area the docked column sits in: 1368px wide, as at 1440px with a minimized sidebar. */
const WORK_AREA = { left: 72, right: 1440, width: 1368 };

let container: HTMLDivElement;
let root: Root;
let trigger: HTMLButtonElement;
let resizeCallbacks = new Set<() => void>();

/** Delivers a layout pass to every live `ResizeObserver`. */
function fireResize(): void {
  act(() => {
    for (const callback of resizeCallbacks) {
      callback();
    }
  });
}

beforeEach(() => {
  resetDocumentViewerStore();
  resizeCallbacks = new Set();
  useSidebar.setState({ isMinimized: true });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 1440,
  });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(): void {
        resizeCallbacks.add(this.callback);
      }
      disconnect(): void {
        resizeCallbacks.delete(this.callback);
      }
      unobserve(): void {}
    },
  );

  container = document.createElement('div');
  container.getBoundingClientRect = () =>
    ({ ...WORK_AREA, top: 0, bottom: 900, height: 900, x: WORK_AREA.left, y: 0 }) as DOMRect;
  document.body.append(container);
  trigger = document.createElement('button');
  trigger.textContent = 'thumbnail';
  document.body.append(trigger);
  root = createRoot(container);
  act(() => root.render(<DockedDocumentViewer />));
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function openDoc(entry: DocumentViewerEntry = DOC): void {
  act(() => useDocumentViewer.getState().open(entry, { trigger }));
}

function region(): HTMLElement | null {
  return container.querySelector('section#document-viewer');
}

function width(section: HTMLElement | null): string | undefined {
  return section?.style.getPropertyValue(DOCKED_WIDTH_VAR);
}

function separator(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[role="separator"]');
  if (!el) {
    throw new Error('no separator');
  }
  return el;
}

function key(target: Element, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe('DockedDocumentViewer', () => {
  it('renders nothing while closed', () => {
    expect(region()).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('renders a labelled region when open, without moving focus', () => {
    trigger.focus();
    openDoc();
    expect(region()?.getAttribute('aria-label')).toBe('Document viewer: Tax Invoice 1042');
    expect(width(region())).toBe('clamp(420px, max(50%, 41rem), 100% - 480px)');
    expect(document.activeElement).toBe(trigger);
  });

  it('swaps the document in place', () => {
    openDoc();
    openDoc({ ...DOC, id: 'doc-2', title: 'Receipt 7' });
    expect(container.querySelectorAll('section').length).toBe(1);
    expect(region()?.getAttribute('aria-label')).toBe('Document viewer: Receipt 7');
  });

  it('✕ closes and focuses the trigger', () => {
    openDoc();
    const close = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close document viewer"]',
    );
    act(() => close?.click());
    expect(region()).toBeNull();
    expect(useDocumentViewer.getState().current).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('does not focus a trigger that has left the page', () => {
    openDoc();
    trigger.remove();
    const focusSpy = vi.spyOn(trigger, 'focus');
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Close document viewer"]')?.click(),
    );
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('Esc inside the viewer closes it and focuses the trigger', () => {
    openDoc();
    const event = key(separator(), { key: 'Escape' });
    expect(event.defaultPrevented).toBe(true);
    expect(region()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Esc outside the viewer does nothing', () => {
    openDoc();
    key(trigger, { key: 'Escape' });
    expect(region()).not.toBeNull();
  });

  it('Esc already handled by a layer does nothing', () => {
    openDoc();
    const preventFirst = (e: Event): void => e.preventDefault();
    document.addEventListener('keydown', preventFirst, { capture: true });
    try {
      key(separator(), { key: 'Escape' });
    } finally {
      document.removeEventListener('keydown', preventFirst, { capture: true });
    }
    expect(region()).not.toBeNull();
  });

  it('Esc in an input that handles it itself does nothing', () => {
    openDoc();
    const readout = container.querySelector<HTMLElement>('[data-slot="document-viewer"]');
    const input = document.createElement('input');
    input.setAttribute('data-local-escape', '');
    readout?.append(input);
    key(input, { key: 'Escape' });
    expect(region()).not.toBeNull();
  });

  it('Expand toggles and resets on close', () => {
    openDoc();
    const expand = (): HTMLButtonElement | null =>
      container.querySelector('button[aria-label="Expand document viewer"]');
    expect(expand()?.getAttribute('aria-pressed')).toBe('false');

    act(() => expand()?.click());
    expect(useDocumentViewer.getState().expanded).toBe(true);
    expect(expand()?.getAttribute('aria-pressed')).toBe('true');
    const viewer = container.querySelector('[data-slot="document-viewer"]');
    expect(viewer?.className).toContain('absolute');
    // The section stays in the flow as a spacer of the same width; the handle hides.
    expect(width(region())).toBe('clamp(420px, max(50%, 41rem), 100% - 480px)');
    expect(container.querySelector('[role="separator"]')).toBeNull();

    act(() => expand()?.click());
    expect(useDocumentViewer.getState().expanded).toBe(false);

    act(() => expand()?.click());
    act(() => useDocumentViewer.getState().close());
    openDoc();
    expect(useDocumentViewer.getState().expanded).toBe(false);
  });

  it('arrow keys on the separator change the width, Enter and double-click reset it', () => {
    openDoc();
    const section = region()!;
    section.getBoundingClientRect = () => ({ width: 684 }) as DOMRect;

    key(separator(), { key: 'ArrowLeft' });
    expect(width(section)).toBe('clamp(420px, 52%, 100% - 480px)');
    key(separator(), { key: 'ArrowRight' });
    key(separator(), { key: 'ArrowRight' });
    expect(width(section)).toBe('clamp(420px, 48%, 100% - 480px)');

    key(separator(), { key: 'Enter' });
    expect(width(section)).toBe('clamp(420px, max(50%, 41rem), 100% - 480px)');

    key(separator(), { key: 'ArrowLeft' });
    act(() => {
      separator().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(width(section)).toBe('clamp(420px, max(50%, 41rem), 100% - 480px)');
  });

  it('arrow keys step from the rendered width, not a stale chosen ratio', () => {
    openDoc();
    const section = region()!;
    section.getBoundingClientRect = () => ({ width: 684 }) as DOMRect;
    key(separator(), { key: 'ArrowLeft' });
    expect(width(section)).toBe('clamp(420px, 52%, 100% - 480px)');

    // The window shrank and the CSS clamp now holds the column at 420px of the same work area.
    section.getBoundingClientRect = () => ({ width: 420 }) as DOMRect;
    key(separator(), { key: 'ArrowLeft' });
    // 420 / 1368 + 2%, not 52% + 2%.
    expect(width(section)).toBe('clamp(420px, 32.7%, 100% - 480px)');
  });

  it('the separator reports its width as a percentage of the work area', () => {
    openDoc();
    const section = region()!;
    const aria = (): (string | null)[] =>
      ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'].map(name =>
        separator().getAttribute(name),
      );

    // Unmeasured: the default half of 0–100.
    expect(aria()).toEqual(['50', '0', '100']);

    // Laid out: 684px of 1368px. The bounds are 420px and 1368 − 480px.
    section.getBoundingClientRect = () => ({ width: 684 }) as DOMRect;
    fireResize();
    expect(aria()).toEqual(['50', '31', '65']);
    expect(separator().getAttribute('aria-valuetext')).toBe('Document viewer 50% wide');
    expect(separator().getAttribute('aria-controls')).toBe('document-viewer');
    expect(separator().getAttribute('aria-label')).toBe('Resize document viewer');

    key(separator(), { key: 'ArrowLeft' });
    expect(aria()[0]).toBe('52');

    key(separator(), { key: 'Enter' });
    expect(aria()[0]).toBe('50');

    act(() => {
      separator().dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 756 }),
      );
    });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 840 }));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    });
    expect(aria()[0]).toBe('44');

    act(() => {
      separator().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(aria()[0]).toBe('50');
  });

  it('a pointerdown focuses the separator, so arrow keys work after a drag', () => {
    openDoc();
    const section = region()!;
    section.getBoundingClientRect = () => ({ width: 684 }) as DOMRect;
    trigger.focus();

    act(() => {
      separator().dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          pointerId: 1,
          clientX: 756,
        }),
      );
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    });
    expect(document.activeElement).toBe(separator());

    key(document.activeElement!, { key: 'ArrowLeft' });
    expect(width(section)).toBe('clamp(420px, 52%, 100% - 480px)');
  });

  it('dragging the separator sets the width from the pointer, clamped', () => {
    openDoc();
    const section = region()!;
    act(() => {
      separator().dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 756 }),
      );
    });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 840 }));
    });
    // (1440 − 840) / 1368
    expect(width(section)).toBe('clamp(420px, 43.86%, 100% - 480px)');

    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
    });
    // The page column keeps 480px: (1368 − 480) / 1368.
    expect(width(section)).toBe('clamp(420px, 64.91%, 100% - 480px)');

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 1000 }));
    });
    expect(width(section)).toBe('clamp(420px, 64.91%, 100% - 480px)');
  });

  it('stays mounted but hidden while suspended, and comes back as it was', () => {
    openDoc();
    const section = region()!;
    section.getBoundingClientRect = () => ({ width: 684 }) as DOMRect;
    key(separator(), { key: 'ArrowLeft' });
    expect(width(section)).toBe('clamp(420px, 52%, 100% - 480px)');
    const viewer = section.querySelector('[data-slot="document-viewer"]');

    let resume: () => void = () => {};
    act(() => {
      resume = useDocumentViewer.getState().suspend();
    });
    // The same element, hidden (`display: none`, so it takes no width) rather than unmounted.
    expect(region()).toBe(section);
    expect(section.hidden).toBe(true);
    expect(useDocumentViewer.getState().current?.id).toBe('doc-1');

    act(() => resume());
    expect(region()).toBe(section);
    expect(section.hidden).toBe(false);
    expect(section.querySelector('[data-slot="document-viewer"]')).toBe(viewer);
    // The dragged width survived.
    expect(width(section)).toBe('clamp(420px, 52%, 100% - 480px)');
  });

  it('ignores Esc while suspended', () => {
    openDoc();
    let resume: () => void = () => {};
    act(() => {
      resume = useDocumentViewer.getState().suspend();
    });
    const event = key(separator(), { key: 'Escape' });
    expect(event.defaultPrevented).toBe(false);
    expect(useDocumentViewer.getState().current?.id).toBe('doc-1');

    act(() => resume());
    key(separator(), { key: 'Escape' });
    expect(useDocumentViewer.getState().current).toBeNull();
  });

  it('hides the fallback drawer while suspended', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.append(trigger);
    document.body.append(dialog);
    openDoc();
    const drawerState = (): string | null | undefined =>
      document.body.querySelector('[data-slot="drawer-content"]')?.getAttribute('data-state');
    expect(drawerState()).toBe('open');
    act(() => {
      useDocumentViewer.getState().suspend();
    });
    // Closed (happy-dom never finishes vaul's exit animation, so the node may linger).
    expect(drawerState() ?? 'closed').toBe('closed');
    expect(useDocumentViewer.getState().placement).toBe('fallback');
  });

  it('uses the drawer instead of docking when opened from a dialog', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.append(trigger);
    document.body.append(dialog);
    openDoc();
    expect(useDocumentViewer.getState().placement).toBe('fallback');
    expect(region()).toBeNull();
    // The drawer portals to the body.
    expect(document.body.querySelector('[data-slot="document-viewer"]')).not.toBeNull();
  });
});
