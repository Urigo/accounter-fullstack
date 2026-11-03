import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MultiSelect } from '../multi-select.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS = [
  { value: 'd', label: 'Delta ltd' },
  { value: 'a', label: 'Alpha ltd' },
  { value: 'c', label: 'Charlie ltd' },
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
  document.body.innerHTML = '';
});

function open(): void {
  act(() => {
    root.render(<MultiSelect options={OPTIONS} onValueChange={() => {}} />);
  });
  const trigger = container.querySelector('button');
  if (!trigger) {
    throw new Error('no trigger rendered');
  }
  act(() => trigger.click());
}

function type(text: string): void {
  const input = document.querySelector<HTMLInputElement>('[cmdk-input]');
  if (!input) {
    throw new Error('no search input rendered');
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function itemTexts(): string[] {
  return [...document.querySelectorAll('[cmdk-item]')].map(item => item.textContent ?? '');
}

describe('MultiSelect search', () => {
  it('matches case-insensitively and keeps tied results in option order', () => {
    open();
    type('A');
    expect(itemTexts().slice(0, 3)).toEqual(['Alpha ltd', 'Delta ltd', 'Charlie ltd']);
    type('LTD');
    expect(itemTexts().slice(0, 3)).toEqual(['Delta ltd', 'Alpha ltd', 'Charlie ltd']);
  });

  it('hides "Select All" while searching and shows it again when cleared', () => {
    open();
    expect(itemTexts()).toContain('(Select All)');
    type('alpha');
    expect(itemTexts()).not.toContain('(Select All)');
    type('');
    expect(itemTexts()).toContain('(Select All)');
  });

  it('says so when nothing matches', () => {
    open();
    type('zzz');
    expect(itemTexts()).not.toContain('Delta ltd');
    expect(document.body.textContent).toContain('No results found.');
  });
});
