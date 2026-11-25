import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/** A container attached to the document and a React root rendering into it. */
export function mountRoot(): { container: HTMLDivElement; root: Root; unmount: () => void } {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

export function buttonByText(scope: ParentNode, text: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find(
    candidate => candidate.textContent?.trim() === text,
  );
  if (!found) {
    throw new Error(`no "${text}" button`);
  }
  return found;
}

export function byLabel<T extends HTMLElement = HTMLInputElement>(
  scope: ParentNode,
  label: string,
): T | null {
  return scope.querySelector<T>(`[aria-label="${label}"]`);
}

/** The control a visible `<label>` with this text points to. */
export function controlByVisibleLabel<T extends HTMLElement = HTMLInputElement>(
  scope: ParentNode,
  text: string,
): T {
  const label = [...scope.querySelectorAll('label')].find(
    candidate => candidate.textContent?.trim() === text,
  );
  const control = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
  if (!control) {
    throw new Error(`no control labelled "${text}"`);
  }
  return control as T;
}

/** A form by its accessible name (the editors label their `<form>`). */
export function formByLabel(scope: ParentNode, label: string): HTMLFormElement {
  const form = scope.querySelector<HTMLFormElement>(`form[aria-label="${label}"]`);
  if (!form) {
    throw new Error(`no "${label}" form`);
  }
  return form;
}

export function typeInto(element: HTMLInputElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function clickOn(element: HTMLElement): void {
  act(() => element.click());
}

export async function clickAndSettle(element: HTMLElement): Promise<void> {
  await act(async () => element.click());
}

export async function leave(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

export function pressKey(element: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    element.dispatchEvent(event);
  });
  return event;
}

/** The text of the elements `aria-describedby` names (that exist). */
export function describedText(element: HTMLElement): string {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

/** Whether a control is disabled, also through a disabled `<fieldset>` around it. */
export function isDisabled(element: HTMLElement): boolean {
  return element.matches(':disabled') || !!element.closest('fieldset:disabled');
}
