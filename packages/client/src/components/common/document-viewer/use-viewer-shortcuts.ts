import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import {
  getTopKeyboardOwnerId,
  useDocumentViewer,
  type KeyboardRank,
} from '@/hooks/use-document-viewer.js';

export type ShortcutAction =
  'zoomIn' | 'zoomOut' | 'fitWidth' | 'actual' | 'rotate' | 'magnifier' | 'previous' | 'next';

/** The key each action is shown with in tooltips and menus. */
export const SHORTCUT_KEYS: Record<ShortcutAction, string> = {
  zoomIn: '+',
  zoomOut: '−',
  fitWidth: '0',
  actual: '1',
  rotate: 'R',
  magnifier: 'M',
  previous: '[',
  next: ']',
};

/** A tooltip text with its shortcut, e.g. `Zoom in (+)`. */
export function withShortcut(label: string, action: ShortcutAction): string {
  return `${label} (${SHORTCUT_KEYS[action]})`;
}

/**
 * R and M match on the letter typed, in either case, on any Latin layout: on AZERTY M sits where a
 * US layout has `;`, and on Dvorak R sits on the US O key, so their physical keys would be wrong.
 */
const BY_LETTER: Record<string, ShortcutAction> = { r: 'rotate', m: 'magnifier' };

/**
 * Digits and brackets match on the physical key (`event.code`), and so do R and M when the layout
 * doesn't type Latin letters: on a Hebrew layout R types ר, M types צ and the brackets are
 * mirrored, so `event.key` would miss them.
 */
const BY_CODE: Record<string, ShortcutAction> = {
  KeyR: 'rotate',
  KeyM: 'magnifier',
  Digit0: 'fitWidth',
  Numpad0: 'fitWidth',
  Digit1: 'actual',
  Numpad1: 'actual',
  BracketLeft: 'previous',
  BracketRight: 'next',
};

/**
 * `+`, `=` and `-` match on the character typed, which is right on every layout that has them;
 * their physical keys are the fallback.
 */
const BY_KEY: Record<string, ShortcutAction> = { '+': 'zoomIn', '=': 'zoomIn', '-': 'zoomOut' };
const BY_FALLBACK_CODE: Record<string, ShortcutAction> = {
  Equal: 'zoomIn',
  NumpadAdd: 'zoomIn',
  Minus: 'zoomOut',
  NumpadSubtract: 'zoomOut',
};

/** One printable ASCII character: what a Latin layout types on a letter key. */
const ASCII_CHARACTER = /^[\x20-\x7e]$/;

/** The physical keys that only stand in for R and M on layouts without Latin letters. */
const LETTER_CODES = new Set(['KeyR', 'KeyM']);

/**
 * The typed `+`, `=` or `-` wins over the physical key: on a German layout `+` sits on the key a US
 * layout calls `BracketRight`. No layout types those three on the R, M or bracket keys of the
 * Hebrew layout, so this costs Israeli users nothing.
 *
 * Then a typed `r` or `m`. A Latin character on the R or M key that isn't that letter (AZERTY's `,`
 * on the US M key, Dvorak's `p` on the US R key) is not the shortcut, and neither is a named key
 * such as `Dead`, `Process` (IME) or `Unidentified`; only a single non-Latin character there
 * (Hebrew) falls back to the physical key.
 */
export function matchShortcut(event: Pick<KeyboardEvent, 'key' | 'code'>): ShortcutAction | null {
  const typed = BY_KEY[event.key] ?? BY_LETTER[event.key.toLowerCase()];
  if (typed) {
    return typed;
  }
  if (
    LETTER_CODES.has(event.code) &&
    (ASCII_CHARACTER.test(event.key) || [...event.key].length !== 1)
  ) {
    return null;
  }
  return BY_CODE[event.code] ?? BY_FALLBACK_CODE[event.code] ?? null;
}

/** Typing targets, and open menus, listboxes and popovers that own their keys. */
const SKIP_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="menu"]',
  '[role="listbox"]',
  // Widgets that own their keys: Radix Select triggers are `button[role=combobox]` and type ahead
  // on letters, sliders and spin buttons step (and may take typed digits), and a tab list is a page
  // control the viewer shouldn't act through. Not radio groups: they only take arrow keys, and the
  // viewer's own fit-mode and magnifier-size toggles are radio groups, so skipping them would turn
  // the shortcuts off right after a click on Fit width.
  '[role="combobox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="tablist"]',
  '[data-radix-popper-content-wrapper]',
].join(',');

/**
 * Whether a keydown is none of the viewer's business: typing in a field, keys inside an open menu
 * or popover, IME composition, or a chord with Ctrl, ⌘ or Alt (browser zoom and copy stay
 * untouched). Shift is allowed, since `+` needs it on most layouts.
 */
export function shouldSkipShortcut(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) {
    return true;
  }
  const { target } = event;
  if (!(target instanceof Element)) {
    return false;
  }
  return (
    (target instanceof HTMLElement && target.isContentEditable) ||
    !!target.closest(SKIP_TARGET_SELECTOR)
  );
}

/**
 * Handlers for the actions a viewer supports. A missing handler, or one returning `false` (say,
 * zoom before the image has loaded), leaves the key alone; a handled key is `preventDefault`ed.
 */
export type ViewerShortcutHandlers = Partial<Record<ShortcutAction, () => boolean | void>>;

/**
 * The viewer keyboard shortcuts (decision 17): global while a viewer is open, except while typing.
 *
 * Every viewer registers as a keyboard owner with its `rank` (docked 0, embedded 1, overlay 2), but
 * only the topmost owner attaches the one `document` keydown listener, so the overlay beats the
 * edit sheet's viewer, which beats the docked one. The id comes from `useId`, and registration is
 * an effect with a cleanup, so StrictMode's double mount ends with one registration.
 *
 * A listener on `document` also hears keys pressed inside a Radix modal (the overlay): the focus
 * trap keeps focus inside, but nothing stops the event bubbling. Esc is not a shortcut here: it
 * closes only from inside a viewer, which each presentation handles itself.
 *
 * `rank` null registers nothing, e.g. while the docked viewer is hidden.
 */
export function useViewerShortcuts(
  rank: KeyboardRank | null | undefined,
  handlers: ViewerShortcutHandlers,
): void {
  const id = useId();
  const register = useDocumentViewer(s => s.registerKeyboardOwner);
  const isTop = useDocumentViewer(
    s => rank != null && getTopKeyboardOwnerId(s.keyboardOwners) === id,
  );
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (rank == null) {
      return;
    }
    return register(id, rank);
  }, [id, rank, register]);

  useEffect(() => {
    if (!isTop) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (shouldSkipShortcut(event)) {
        return;
      }
      const action = matchShortcut(event);
      const handler = action ? handlersRef.current[action] : undefined;
      if (!handler || handler() === false) {
        return;
      }
      event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isTop]);
}
