// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ComboBox } from '../combo-box.js';

const DATA = [
  { value: 'rd', label: 'Research & Development' },
  { value: 'marketing', label: 'Marketing' },
];

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
});

function trigger(): HTMLButtonElement {
  const found = container.querySelector('button');
  if (!found) {
    throw new Error('no trigger button rendered');
  }
  return found;
}

describe('ComboBox error wiring', () => {
  it('points the trigger at the error text and marks it invalid', () => {
    act(() => {
      root.render(<ComboBox data={DATA} value={null} error="Tax category is required" />);
    });

    const message = container.querySelector('p');
    expect(message?.textContent).toBe('Tax category is required');
    expect(message?.id).toBeTruthy();
    expect(trigger().getAttribute('aria-describedby')).toBe(message?.id);
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
  });

  it('sets neither attribute when there is no error', () => {
    act(() => {
      root.render(<ComboBox data={DATA} value={null} />);
    });

    expect(container.querySelector('p')).toBeNull();
    expect(trigger().getAttribute('aria-describedby')).toBeNull();
    expect(trigger().getAttribute('aria-invalid')).toBeNull();
  });

  it('associates the label with the trigger', () => {
    act(() => {
      root.render(<ComboBox data={DATA} value={null} label="Tax category" />);
    });

    const label = container.querySelector('label');
    expect(label?.textContent).toBe('Tax category');
    expect(label?.getAttribute('for')).toBe(trigger().id);
  });
});
