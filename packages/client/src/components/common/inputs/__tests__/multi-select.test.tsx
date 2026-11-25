import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('MultiSelect onOpenChange', () => {
  // The chevron sits inside both the trigger's own button and Radix's, so a click on it bubbles
  // through both toggles, as a real click does.
  function trigger(): SVGElement {
    const chevron = container.querySelector<SVGElement>('button svg.lucide-chevron-down');
    if (!chevron) {
      throw new Error('no trigger rendered');
    }
    return chevron;
  }

  function item(text: string): HTMLElement {
    const match = [...document.querySelectorAll<HTMLElement>('[cmdk-item]')].find(
      element => element.textContent === text,
    );
    if (!match) {
      throw new Error(`no "${text}" item rendered`);
    }
    return match;
  }

  it('reports each open and close once, and not the toggles in between', () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const onValueChange = vi.fn<(value: string[]) => void>();
    act(() => {
      root.render(
        <MultiSelect options={OPTIONS} onValueChange={onValueChange} onOpenChange={onOpenChange} />,
      );
    });

    act(() => {
      trigger().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onOpenChange.mock.calls).toEqual([[true]]);

    act(() => item('Alpha ltd').click());
    act(() => item('Charlie ltd').click());
    expect(onValueChange).toHaveBeenLastCalledWith(['a', 'c']);
    expect(onOpenChange.mock.calls).toEqual([[true]]);

    act(() => item('Close').click());
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(document.querySelector('[cmdk-item]')).toBeNull();

    act(() => {
      trigger().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      trigger().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false]]);
  });
});
