import { act, StrictMode, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KEYBOARD_RANK,
  resetDocumentViewerStore,
  useDocumentViewer,
  type KeyboardRank,
} from '@/hooks/use-document-viewer.js';
import {
  matchShortcut,
  useViewerShortcuts,
  withShortcut,
  type ShortcutAction,
  type ViewerShortcutHandlers,
} from '../use-viewer-shortcuts.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTIONS: ShortcutAction[] = [
  'zoomIn',
  'zoomOut',
  'fitWidth',
  'actual',
  'rotate',
  'magnifier',
  'previous',
  'next',
];

function makeHandlers(): Record<ShortcutAction, ReturnType<typeof vi.fn<() => void>>> {
  return Object.fromEntries(ACTIONS.map(action => [action, vi.fn<() => void>()])) as Record<
    ShortcutAction,
    ReturnType<typeof vi.fn<() => void>>
  >;
}

function Owner({
  rank,
  handlers,
}: {
  rank: KeyboardRank | null;
  handlers: ViewerShortcutHandlers;
}): ReactElement {
  useViewerShortcuts(rank, handlers);
  return <div />;
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

/** Dispatches a keydown on `target` (the body by default) and returns it. */
function press(init: KeyboardEventInit, target: Element = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe('matchShortcut', () => {
  it.each([
    [{ key: '+', code: 'Equal' }, 'zoomIn'],
    [{ key: '=', code: 'Equal' }, 'zoomIn'],
    [{ key: '+', code: 'NumpadAdd' }, 'zoomIn'],
    [{ key: '-', code: 'Minus' }, 'zoomOut'],
    [{ key: '-', code: 'NumpadSubtract' }, 'zoomOut'],
    // A layout that types something else on the physical keys still zooms.
    [{ key: 'ß', code: 'Minus' }, 'zoomOut'],
    [{ key: '´', code: 'Equal' }, 'zoomIn'],
    // German layout: `+` is on the key a US layout calls `BracketRight`; the typed `+` wins.
    [{ key: '+', code: 'BracketRight' }, 'zoomIn'],
    [{ key: '0', code: 'Digit0' }, 'fitWidth'],
    [{ key: '0', code: 'Numpad0' }, 'fitWidth'],
    [{ key: '1', code: 'Digit1' }, 'actual'],
    [{ key: '1', code: 'Numpad1' }, 'actual'],
    [{ key: 'r', code: 'KeyR' }, 'rotate'],
    [{ key: 'm', code: 'KeyM' }, 'magnifier'],
    [{ key: '[', code: 'BracketLeft' }, 'previous'],
    [{ key: ']', code: 'BracketRight' }, 'next'],
    // Hebrew layout: R types ר, M types צ, and the brackets are mirrored.
    [{ key: 'ר', code: 'KeyR' }, 'rotate'],
    [{ key: 'צ', code: 'KeyM' }, 'magnifier'],
    [{ key: ']', code: 'BracketLeft' }, 'previous'],
    [{ key: '[', code: 'BracketRight' }, 'next'],
    // Shift doesn't matter for the letters.
    [{ key: 'R', code: 'KeyR' }, 'rotate'],
    [{ key: 'M', code: 'KeyM' }, 'magnifier'],
    // AZERTY: M is on the key a US layout calls `Semicolon`.
    [{ key: 'm', code: 'Semicolon' }, 'magnifier'],
    [{ key: 'r', code: 'KeyR' }, 'rotate'],
    // Dvorak: R is on the US O key, M stays on the US M key.
    [{ key: 'r', code: 'KeyO' }, 'rotate'],
    [{ key: 'm', code: 'KeyM' }, 'magnifier'],
  ] as const)('%o → %s', (event, action) => {
    expect(matchShortcut(event)).toBe(action);
  });

  it('ignores other keys', () => {
    expect(matchShortcut({ key: 'a', code: 'KeyA' })).toBeNull();
    expect(matchShortcut({ key: 'Escape', code: 'Escape' })).toBeNull();
    // AZERTY types `,` on the US M key, and Dvorak types `p` on the US R key: not the shortcuts.
    expect(matchShortcut({ key: ',', code: 'KeyM' })).toBeNull();
    expect(matchShortcut({ key: 'p', code: 'KeyR' })).toBeNull();
    expect(matchShortcut({ key: '.', code: 'KeyR' })).toBeNull();
    // Named keys on the R or M key (a dead key, an IME, an unknown key) are not the shortcuts.
    expect(matchShortcut({ key: 'Dead', code: 'KeyR' })).toBeNull();
    expect(matchShortcut({ key: 'Process', code: 'KeyM' })).toBeNull();
    expect(matchShortcut({ key: 'Unidentified', code: 'KeyR' })).toBeNull();
  });
});

describe('withShortcut', () => {
  it('appends the key', () => {
    expect(withShortcut('Rotate 90°', 'rotate')).toBe('Rotate 90° (R)');
  });
});

describe('useViewerShortcuts', () => {
  it.each([
    [{ key: '+', code: 'Equal', shiftKey: true }, 'zoomIn'],
    [{ key: '-', code: 'Minus' }, 'zoomOut'],
    [{ key: '0', code: 'Digit0' }, 'fitWidth'],
    [{ key: '1', code: 'Digit1' }, 'actual'],
    [{ key: 'ר', code: 'KeyR' }, 'rotate'],
    [{ key: 'm', code: 'KeyM' }, 'magnifier'],
    [{ key: ']', code: 'BracketLeft' }, 'previous'],
    [{ key: ']', code: 'BracketRight' }, 'next'],
  ] as const)('%o fires %s and is prevented', (init, action) => {
    const handlers = makeHandlers();
    act(() => root.render(<Owner rank={KEYBOARD_RANK.docked} handlers={handlers} />));
    const event = press(init);
    expect(handlers[action]).toHaveBeenCalledTimes(1);
    for (const other of ACTIONS.filter(a => a !== action)) {
      expect(handlers[other]).not.toHaveBeenCalled();
    }
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves a key alone when its handler is missing or declines it', () => {
    const rotate = vi.fn<() => boolean>(() => false);
    act(() => root.render(<Owner rank={KEYBOARD_RANK.embedded} handlers={{ rotate }} />));
    expect(press({ key: 'r', code: 'KeyR' }).defaultPrevented).toBe(false);
    expect(rotate).toHaveBeenCalledTimes(1);
    // No `next` handler (the embedded viewer has no siblings): nothing happens.
    expect(press({ key: ']', code: 'BracketRight' }).defaultPrevented).toBe(false);
  });

  it.each([
    ['an input', '<input />', 'input'],
    ['a textarea', '<textarea></textarea>', 'textarea'],
    ['a select', '<select><option>a</option></select>', 'select'],
    ['a contenteditable', '<div contenteditable="true"><span>x</span></div>', 'span'],
    ['an open menu', '<div role="menu"><div role="menuitem">x</div></div>', '[role="menuitem"]'],
    ['a listbox', '<div role="listbox"><div role="option">x</div></div>', '[role="option"]'],
    // The edit form's Radix Select triggers.
    ['a combobox', '<button role="combobox">x</button>', 'button'],
    ['a slider', '<span role="slider" tabindex="0">x</span>', '[role="slider"]'],
    ['a spin button', '<span role="spinbutton" tabindex="0">x</span>', '[role="spinbutton"]'],
    ['a tab list', '<div role="tablist"><button role="tab">x</button></div>', '[role="tab"]'],
    [
      'a Radix popover',
      '<div data-radix-popper-content-wrapper><button>x</button></div>',
      'button',
    ],
  ])('skips keys typed in %s', (_, html, selector) => {
    const handlers = makeHandlers();
    act(() => root.render(<Owner rank={KEYBOARD_RANK.docked} handlers={handlers} />));
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.append(host);
    const target = host.querySelector(selector);
    if (!target) {
      throw new Error('no target');
    }
    const event = press({ key: 'r', code: 'KeyR' }, target);
    expect(handlers.rotate).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("still works from a radio group, such as the viewer's own fit-mode toggle", () => {
    const handlers = makeHandlers();
    act(() => root.render(<Owner rank={KEYBOARD_RANK.docked} handlers={handlers} />));
    const host = document.createElement('div');
    host.innerHTML =
      '<div role="radiogroup" aria-label="Fit mode"><button role="radio">Fit width</button></div>';
    document.body.append(host);
    const event = press({ key: '+', code: 'Equal' }, host.querySelector('[role="radio"]')!);
    expect(handlers.zoomIn).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['⌘', { metaKey: true }],
    ['Alt', { altKey: true }],
    ['IME composition', { isComposing: true }],
  ])('skips keys with %s, so browser zoom and copy are untouched', (_, modifiers) => {
    const handlers = makeHandlers();
    act(() => root.render(<Owner rank={KEYBOARD_RANK.docked} handlers={handlers} />));
    const zoomIn = press({ key: '=', code: 'Equal', ...modifiers });
    const fit = press({ key: '0', code: 'Digit0', ...modifiers });
    expect(handlers.zoomIn).not.toHaveBeenCalled();
    expect(handlers.fitWidth).not.toHaveBeenCalled();
    expect(zoomIn.defaultPrevented).toBe(false);
    expect(fit.defaultPrevented).toBe(false);
  });

  it('only the topmost owner reacts: overlay over embedded over docked', () => {
    const docked = makeHandlers();
    const embedded = makeHandlers();
    const overlay = makeHandlers();
    const renderOwners = (withOverlay: boolean, withEmbedded: boolean): void =>
      act(() =>
        root.render(
          <>
            <Owner rank={KEYBOARD_RANK.docked} handlers={docked} />
            {withEmbedded && <Owner rank={KEYBOARD_RANK.embedded} handlers={embedded} />}
            {withOverlay && <Owner rank={KEYBOARD_RANK.overlay} handlers={overlay} />}
          </>,
        ),
      );

    renderOwners(true, true);
    press({ key: 'r', code: 'KeyR' });
    expect([overlay.rotate, embedded.rotate, docked.rotate].map(f => f.mock.calls.length)).toEqual(
      [1, 0, 0],
    );

    renderOwners(false, true);
    press({ key: 'r', code: 'KeyR' });
    expect([overlay.rotate, embedded.rotate, docked.rotate].map(f => f.mock.calls.length)).toEqual(
      [1, 1, 0],
    );

    renderOwners(false, false);
    press({ key: 'r', code: 'KeyR' });
    expect([overlay.rotate, embedded.rotate, docked.rotate].map(f => f.mock.calls.length)).toEqual(
      [1, 1, 1],
    );
  });

  it('a null rank registers nothing', () => {
    const handlers = makeHandlers();
    act(() => root.render(<Owner rank={null} handlers={handlers} />));
    press({ key: 'r', code: 'KeyR' });
    expect(handlers.rotate).not.toHaveBeenCalled();
    expect(useDocumentViewer.getState().keyboardOwners).toEqual([]);
  });

  it('registers once under StrictMode, and unregisters on unmount', () => {
    const handlers = makeHandlers();
    act(() =>
      root.render(
        <StrictMode>
          <Owner rank={KEYBOARD_RANK.overlay} handlers={handlers} />
        </StrictMode>,
      ),
    );
    expect(useDocumentViewer.getState().keyboardOwners).toHaveLength(1);
    press({ key: 'r', code: 'KeyR' });
    expect(handlers.rotate).toHaveBeenCalledTimes(1);

    act(() => root.render(<></>));
    expect(useDocumentViewer.getState().keyboardOwners).toEqual([]);
    press({ key: 'r', code: 'KeyR' });
    expect(handlers.rotate).toHaveBeenCalledTimes(1);
  });

  it('calls the latest handlers without re-attaching', () => {
    const first = makeHandlers();
    const second = makeHandlers();
    act(() => root.render(<Owner rank={KEYBOARD_RANK.docked} handlers={first} />));
    act(() => root.render(<Owner rank={KEYBOARD_RANK.docked} handlers={second} />));
    press({ key: 'm', code: 'KeyM' });
    expect(first.magnifier).not.toHaveBeenCalled();
    expect(second.magnifier).toHaveBeenCalledTimes(1);
  });
});
