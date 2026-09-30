// @vitest-environment happy-dom

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Currency } from '../../../../gql/graphql.js';
import { CurrencyInput } from '../currency-input.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

function render(ui: Parameters<Root['render']>[0]): void {
  act(() => root.render(ui));
}

describe('CurrencyInput refs', () => {
  it('forwards an object ref to the amount input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<CurrencyInput ref={ref} value={10} currencyCodeProps={{ value: Currency.Ils }} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(container.querySelector('input'));
  });

  // react-hook-form's `field.ref` is a callback; it is what focuses the field after a failed submit.
  it('forwards a callback ref to the amount input', () => {
    const ref = vi.fn<(node: HTMLInputElement | null) => void>();
    render(<CurrencyInput ref={ref} value={10} currencyCodeProps={{ value: Currency.Ils }} />);

    expect(ref).toHaveBeenCalledWith(container.querySelector('input'));
  });

  it('clamps an out-of-range value on blur when given a callback ref', () => {
    const ref = vi.fn<(node: HTMLInputElement | null) => void>();
    render(
      <CurrencyInput ref={ref} value={500} max={100} currencyCodeProps={{ value: Currency.Ils }} />,
    );
    const input = container.querySelector('input')!;
    // React reports errors thrown by event handlers on `window` rather than rethrowing them.
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent): void => {
      errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', onError);

    // React listens for `focusout`, not `blur`.
    act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    window.removeEventListener('error', onError);

    expect(errors).toEqual([]);
    expect(input.value).toBe('100');
  });

  it('attaches the currency field ref to the currency picker button', () => {
    const currencyRef = vi.fn<(node: unknown) => void>();
    render(
      <CurrencyInput value={10} currencyCodeProps={{ value: Currency.Usd, ref: currencyRef }} />,
    );

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(currencyRef).toHaveBeenCalledWith(button);
  });
});
