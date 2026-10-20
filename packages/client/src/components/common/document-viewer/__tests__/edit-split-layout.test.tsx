import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getViewerTrigger,
  resetDocumentViewerStore,
  useDocumentViewer,
} from '../../../../hooks/use-document-viewer.js';
import { DocumentViewer } from '../document-viewer.js';
import {
  DocumentEditSplit,
  EDIT_SPLIT_FORM_WIDTH_VAR,
  SPLIT_MEDIA_QUERY,
} from '../edit-split-layout.js';
import type { DocumentViewerEntry } from '../types.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The split's box: 1400px wide from x = 20, as in a 1440px sheet. */
const SPLIT_RECT = { left: 20, right: 1420, width: 1400, top: 0, bottom: 800, height: 800 };

let container: HTMLDivElement;
let root: Root;
/** Whether the `lg` media query matches (side by side) or not (stacked). */
let wide = true;
let resizeCallbacks = new Set<() => void>();
/** `change` listeners on the stubbed media query lists. */
let mediaListeners = new Set<() => void>();

/** Crosses the `lg` breakpoint, notifying the live media query lists. */
function setWide(next: boolean): void {
  wide = next;
  act(() => {
    for (const listener of mediaListeners) {
      listener();
    }
  });
}

/** Delivers a layout pass to every live `ResizeObserver`. */
function fireResize(): void {
  act(() => {
    for (const callback of resizeCallbacks) {
      callback();
    }
  });
}

const ENTRY: DocumentViewerEntry = {
  id: 'doc-1',
  imageUrl: 'https://example.com/scan.jpg',
  fileUrl: null,
  title: 'Invoice 1',
};

beforeEach(() => {
  // Sizes and the hidden pane are remembered in `localStorage`; each test starts from defaults.
  localStorage.clear();
  resetDocumentViewerStore();
  wide = true;
  resizeCallbacks = new Set();
  mediaListeners = new Set();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === SPLIT_MEDIA_QUERY ? wide : false,
    media: query,
    addEventListener: (_: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => mediaListeners.delete(listener),
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
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function Harness({
  initialHidden = false,
  entry,
}: {
  initialHidden?: boolean;
  entry?: DocumentViewerEntry;
}): ReactElement {
  const [hidden, setHidden] = useState(initialHidden);
  return (
    <DocumentEditSplit
      entry={entry}
      hidden={hidden}
      onHiddenChange={setHidden}
      form={<input aria-label="Serial" />}
      viewer={({ onHide, onToggleExpand, expanded }) => (
        <DocumentViewer
          source={{ imageUrl: 'https://example.com/scan.jpg', fileUrl: null, title: 'Invoice 1' }}
          documentKey="doc-1"
          closeVariant="hide"
          onClose={onHide}
          onToggleExpand={onToggleExpand}
          expanded={expanded}
        />
      )}
    />
  );
}

function render(element: ReactElement = <Harness />): void {
  act(() => root.render(element));
  const split = splitRoot();
  split.getBoundingClientRect = () => ({ ...SPLIT_RECT, x: 20, y: 0 }) as DOMRect;
}

function splitRoot(): HTMLElement {
  return query('[data-slot="edit-split"]');
}

function query<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = container.querySelector<T>(selector);
  if (!el) {
    throw new Error(`no ${selector}`);
  }
  return el;
}

function formWidth(): string {
  return splitRoot().style.getPropertyValue(EDIT_SPLIT_FORM_WIDTH_VAR);
}

function key(target: Element, init: KeyboardEventInit): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  });
}

function click(selector: string): void {
  act(() => query<HTMLButtonElement>(selector).click());
}

describe('DocumentEditSplit', () => {
  it('both panes opt out of vaul dragging', () => {
    render();
    expect(query('[data-slot="edit-split-form"]').hasAttribute('data-vaul-no-drag')).toBe(true);
    expect(query('[data-slot="edit-split-viewer"]').hasAttribute('data-vaul-no-drag')).toBe(true);
    // The handle sits inside the viewer pane, so it is covered too.
    expect(query('[role="separator"]').closest('[data-vaul-no-drag]')).not.toBeNull();
  });

  it('defaults to 50/50, with the hide action in the viewer header', () => {
    render();
    expect(formWidth()).toBe('clamp(320px, 50%, 100% - 320px)');
    expect(container.querySelector('button[aria-label="Close document viewer"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Hide document"]')).not.toBeNull();
  });

  it('Hide collapses the viewer to a strip and Show restores it, moving focus', () => {
    render();
    const viewer = query('[data-slot="document-viewer"]');
    const image = viewer.querySelector('img');
    click('button[aria-label="Hide document"]');
    const strip = query('[data-slot="edit-split-viewer"]');
    expect(strip.hasAttribute('data-hidden')).toBe(true);
    expect(strip.hasAttribute('data-vaul-no-drag')).toBe(true);
    // The viewer stays mounted inside a hidden wrapper, so Show doesn't reset zoom or reload.
    expect(query('[data-slot="edit-split-viewer-content"]').hidden).toBe(true);
    expect(query('[data-slot="document-viewer"]')).toBe(viewer);
    expect(container.querySelector('[role="separator"]')).toBeNull();
    const show = [...strip.querySelectorAll('button')].find(
      b => b.textContent === 'Show document',
    )!;
    expect(document.activeElement).toBe(show);
    // The form takes the full width.
    expect(query('[data-slot="edit-split-form"]').className).not.toContain('lg:w-');

    act(() => show.click());
    expect(query('[data-slot="edit-split-viewer-content"]').hidden).toBe(false);
    expect(query('[data-slot="document-viewer"]')).toBe(viewer);
    expect(viewer.querySelector('img')).toBe(image);
    expect(container.textContent).not.toContain('Show document');
    expect(document.activeElement).toBe(query('button[aria-label="Hide document"]'));
  });

  it('puts the viewer first in the DOM and reverses the row, so tab order matches both layouts', () => {
    render();
    const panes = [...splitRoot().children].map(el => el.getAttribute('data-slot'));
    expect(panes).toEqual(['edit-split-viewer', 'edit-split-form']);
    expect(splitRoot().className).toContain('flex-col');
    expect(splitRoot().className).toContain('lg:flex-row-reverse');
  });

  it('a pointer press on the separator focuses it, so the arrow keys work after a drag', () => {
    render();
    const separator = query('[role="separator"]');
    act(() => {
      separator.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 720 }),
      );
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    });
    expect(document.activeElement).toBe(separator);
    key(separator, { key: 'ArrowLeft' });
    expect(formWidth()).toBe('clamp(320px, 48%, 100% - 320px)');
  });

  it('arrow keys on the separator move the split, Enter and double-click reset it', () => {
    render();
    const separator = query('[role="separator"]');
    expect(separator.getAttribute('aria-controls')).toBe(
      query('[data-slot="edit-split-form"]').id,
    );

    key(separator, { key: 'ArrowLeft' });
    expect(formWidth()).toBe('clamp(320px, 48%, 100% - 320px)');
    key(separator, { key: 'ArrowRight' });
    key(separator, { key: 'ArrowRight' });
    expect(formWidth()).toBe('clamp(320px, 52%, 100% - 320px)');

    key(separator, { key: 'Enter' });
    expect(formWidth()).toBe('clamp(320px, 50%, 100% - 320px)');

    key(separator, { key: 'ArrowLeft' });
    act(() => {
      query('[role="separator"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(formWidth()).toBe('clamp(320px, 50%, 100% - 320px)');
  });

  it('arrow keys step from the rendered form width, not a stale chosen ratio', () => {
    render();
    const formPane = query('[data-slot="edit-split-form"]');
    formPane.getBoundingClientRect = () => ({ width: 700 }) as DOMRect;
    key(query('[role="separator"]'), { key: 'ArrowRight' });
    expect(formWidth()).toBe('clamp(320px, 52%, 100% - 320px)');

    // The sheet narrowed and the CSS clamp now holds the form at 320px of the same split.
    formPane.getBoundingClientRect = () => ({ width: 320 }) as DOMRect;
    key(query('[role="separator"]'), { key: 'ArrowRight' });
    // 320 / 1400 + 2%, not 52% + 2%.
    expect(formWidth()).toBe('clamp(320px, 24.86%, 100% - 320px)');
  });

  it('the separator reports the form width as a percentage of the split', () => {
    render();
    const separator = (): HTMLElement => query('[role="separator"]');
    const aria = (): (string | null)[] =>
      ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'].map(name =>
        separator().getAttribute(name),
      );

    // Unmeasured: the default half of 0–100.
    expect(aria()).toEqual(['50', '0', '100']);

    // Laid out: 700px of 1400px. The bounds are 320px and 1400 − 320px.
    query('[data-slot="edit-split-form"]').getBoundingClientRect = () =>
      ({ width: 700 }) as DOMRect;
    fireResize();
    expect(aria()).toEqual(['50', '23', '77']);
    expect(separator().getAttribute('aria-valuetext')).toBe('Form 50% wide');
    expect(separator().getAttribute('aria-label')).toBe('Resize document pane');

    key(separator(), { key: 'ArrowLeft' });
    expect(aria()[0]).toBe('48');

    key(separator(), { key: 'Enter' });
    expect(aria()[0]).toBe('50');

    act(() => {
      separator().dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 720 }),
      );
    });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 580 }));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    });
    expect(aria()[0]).toBe('40');

    act(() => {
      separator().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(aria()[0]).toBe('50');
  });

  it('dragging the separator follows the pointer, clamped to both pane minimums', () => {
    render();
    const separator = query('[role="separator"]');
    act(() => {
      separator.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 720 }),
      );
    });
    expect(separator.hasAttribute('data-dragging')).toBe(true);

    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 580 }));
    });
    // (580 − 20) / 1400
    expect(formWidth()).toBe('clamp(320px, 40%, 100% - 320px)');

    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
    });
    // The form keeps 320px: 320 / 1400.
    expect(formWidth()).toBe('clamp(320px, 22.86%, 100% - 320px)');

    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 1500 }));
    });
    // The viewer keeps 320px: 1080 / 1400.
    expect(formWidth()).toBe('clamp(320px, 77.14%, 100% - 320px)');

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 600 }));
    });
    expect(formWidth()).toBe('clamp(320px, 77.14%, 100% - 320px)');
    expect(query('[role="separator"]').hasAttribute('data-dragging')).toBe(false);
  });

  it('Expand covers the form and toggles back', () => {
    render();
    const expand = (): HTMLButtonElement =>
      query<HTMLButtonElement>('button[data-slot="viewer-expand"]');
    expect(expand().getAttribute('aria-label')).toBe('Expand document viewer');

    act(() => expand().click());
    expect(expand().getAttribute('aria-label')).toBe('Restore document viewer width');
    expect(query('[data-slot="edit-split-viewer-content"]').className).toContain('absolute');
    // The pane stays as a spacer, positioned against the split; the handle hides.
    expect(query('[data-slot="edit-split-viewer"]').className).not.toContain('relative');
    expect(container.querySelector('[role="separator"]')).toBeNull();

    act(() => expand().click());
    expect(query('[data-slot="edit-split-viewer-content"]').className).not.toContain('absolute');
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
  });

  it('hiding an expanded viewer and showing it again starts collapsed', () => {
    render();
    click('button[data-slot="viewer-expand"]');
    click('button[aria-label="Hide document"]');
    act(() => query<HTMLButtonElement>('[data-slot="edit-split-viewer"] button').click());
    expect(
      query('button[data-slot="viewer-expand"]').getAttribute('aria-label'),
    ).toBe('Expand document viewer');
  });

  it('stacked below lg, Expand opens the full-screen overlay with the button as trigger', () => {
    wide = false;
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 800,
    });
    // The edit sheet is a vaul dialog.
    render(
      <div role="dialog">
        <Harness entry={ENTRY} />
      </div>,
    );
    const expand = query<HTMLButtonElement>('button[data-slot="viewer-expand"]');
    expect(expand.getAttribute('aria-label')).toBe('Expand document viewer');

    act(() => expand.click());

    expect(useDocumentViewer.getState()).toMatchObject({
      current: ENTRY,
      placement: 'overlay',
      overlayMode: 'fullscreen',
    });
    expect(getViewerTrigger()).toBe(expand);
    // The split itself doesn't change: nothing covers the form.
    expect(expand.getAttribute('aria-label')).toBe('Expand document viewer');
  });

  it('side by side, Expand stays in the sheet and never opens the overlay', () => {
    render(<Harness entry={ENTRY} />);
    act(() => query<HTMLButtonElement>('button[data-slot="viewer-expand"]').click());
    expect(useDocumentViewer.getState().current).toBeNull();
  });

  it('stacked below lg without an entry: no separator and no Expand', () => {
    wide = false;
    render();
    expect(container.querySelector('[role="separator"]')).toBeNull();
    expect(container.querySelector('button[data-slot="viewer-expand"]')).toBeNull();
    expect(query('[data-slot="edit-split-viewer"]').className).toContain('h-[45vh]');
    expect(container.querySelector('button[aria-label="Hide document"]')).not.toBeNull();
  });

  it('Esc while expanded collapses the viewer and marks the key handled', () => {
    render();
    click('button[data-slot="viewer-expand"]');
    const expand = query<HTMLButtonElement>('button[data-slot="viewer-expand"]');
    expect(expand.getAttribute('aria-label')).toBe('Restore document viewer width');

    // A document capture listener stands in for Radix's, which closes the sheet on Esc.
    const seen: boolean[] = [];
    const radix = (event: KeyboardEvent): void => {
      seen.push(event.defaultPrevented);
    };
    document.addEventListener('keydown', radix, { capture: true });
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => {
      expand.dispatchEvent(event);
    });
    document.removeEventListener('keydown', radix, { capture: true });

    expect(event.defaultPrevented).toBe(true);
    // Stopped before it reached the sheet's listener.
    expect(seen).toEqual([]);
    expect(query('[data-slot="edit-split-viewer-content"]').className).not.toContain('absolute');
    expect(query('[role="separator"]')).not.toBeNull();
  });

  it.each([
    ['the body (macOS: a clicked button takes no focus)', () => document.body],
    ['an ancestor of the split, such as the dialog content', () => container],
  ])('Esc while expanded with the target on %s still collapses', (_, target) => {
    render();
    click('button[data-slot="viewer-expand"]');
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => {
      target().dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(query('[data-slot="edit-split-viewer-content"]').className).not.toContain('absolute');
  });

  it('Esc while expanded from a portaled layer elsewhere is left to that layer', () => {
    render();
    click('button[data-slot="viewer-expand"]');
    const layer = document.createElement('div');
    layer.setAttribute('data-radix-popper-content-wrapper', '');
    const item = document.createElement('button');
    layer.append(item);
    document.body.append(layer);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => {
      item.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(query('[data-slot="edit-split-viewer-content"]').className).toContain('absolute');
  });

  it('leaves Esc alone when not expanded, or from a field that handles Esc itself', () => {
    render();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => {
      query('button[aria-label="Hide document"]').dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);

    click('button[data-slot="viewer-expand"]');
    const field = document.createElement('input');
    field.setAttribute('data-local-escape', '');
    query('[data-slot="edit-split-viewer-content"]').append(field);
    key(field, { key: 'Escape' });
    expect(query('[data-slot="edit-split-viewer-content"]').className).toContain('absolute');
  });

  it('takes the covered form out of the tab order and the accessibility tree while expanded', () => {
    render();
    const form = query('[data-slot="edit-split-form"]');
    expect(form.hasAttribute('inert')).toBe(false);
    expect(form.hasAttribute('aria-hidden')).toBe(false);

    click('button[data-slot="viewer-expand"]');
    expect(form.hasAttribute('inert')).toBe(true);
    expect(form.getAttribute('aria-hidden')).toBe('true');

    click('button[data-slot="viewer-expand"]');
    expect(form.hasAttribute('inert')).toBe(false);
    expect(form.hasAttribute('aria-hidden')).toBe(false);
  });

  it('narrowing to the stacked layout drops Expand, so widening again starts collapsed', () => {
    render(<Harness entry={ENTRY} />);
    click('button[data-slot="viewer-expand"]');
    expect(query('[data-slot="edit-split-viewer-content"]').className).toContain('absolute');

    setWide(false);
    expect(query('[data-slot="edit-split-viewer-content"]').className).not.toContain('absolute');
    setWide(true);
    expect(query('[data-slot="edit-split-viewer-content"]').className).not.toContain('absolute');
    expect(
      query('button[data-slot="viewer-expand"]').getAttribute('aria-label'),
    ).toBe('Expand document viewer');
  });

  it('starts in the side-by-side layout on the first commit, with no stacked frame', () => {
    const layouts: string[] = [];
    function Probe(): ReactElement {
      return (
        <DocumentEditSplit
          hidden={false}
          onHiddenChange={() => {}}
          form={null}
          viewer={({ onToggleExpand }) => {
            layouts.push(onToggleExpand ? 'side-by-side' : 'stacked');
            return <div />;
          }}
        />
      );
    }
    act(() => root.render(<Probe />));
    expect(layouts[0]).toBe('side-by-side');
    expect(layouts).not.toContain('stacked');
  });

  it('drops a focus request the parent did not apply', () => {
    function Ignoring({ hidden }: { hidden: boolean }): ReactElement {
      return (
        <DocumentEditSplit
          hidden={hidden}
          onHiddenChange={() => {}}
          form={<input aria-label="Serial" />}
          viewer={({ onHide }) => (
            <button type="button" aria-label="Hide document" onClick={onHide}>
              Hide
            </button>
          )}
        />
      );
    }
    act(() => root.render(<Ignoring hidden={false} />));
    click('button[aria-label="Hide document"]');
    expect(query('[data-slot="edit-split-viewer"]').hasAttribute('data-hidden')).toBe(false);

    // A later change from outside doesn't pull focus to the Show button.
    act(() => root.render(<Ignoring hidden />));
    expect(document.activeElement?.textContent).not.toBe('Show document');
  });

  it('tells the form when its pane is narrow', () => {
    const seen: boolean[] = [];
    act(() =>
      root.render(
        <DocumentEditSplit
          hidden={false}
          onHiddenChange={() => {}}
          form={({ narrow }) => {
            seen.push(narrow);
            return <span data-testid="narrow">{String(narrow)}</span>;
          }}
          viewer={() => <div />}
        />,
      ),
    );
    const formPane = query('[data-slot="edit-split-form"]');
    splitRoot().getBoundingClientRect = () => ({ ...SPLIT_RECT, x: 20, y: 0 }) as DOMRect;
    // Before the first layout, it isn't narrow.
    expect(seen.at(-1)).toBe(false);

    formPane.getBoundingClientRect = () => ({ width: 400 }) as DOMRect;
    fireResize();
    expect(query('[data-testid="narrow"]').textContent).toBe('true');

    formPane.getBoundingClientRect = () => ({ width: 700 }) as DOMRect;
    fireResize();
    expect(query('[data-testid="narrow"]').textContent).toBe('false');
  });

  it('starts hidden when asked', () => {
    render(<Harness initialHidden />);
    expect(query('[data-slot="edit-split-viewer"]').hasAttribute('data-hidden')).toBe(true);
    // Mounting hidden doesn't steal focus.
    expect(document.activeElement).toBe(document.body);
  });
});
