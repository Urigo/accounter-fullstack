// @vitest-environment happy-dom
import { act, createRef } from 'react';
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

describe('ComboBox trigger layout', () => {
  it('lays the value out left with the chevron on the right', () => {
    act(() => {
      root.render(<ComboBox data={DATA} value="marketing" />);
    });

    const classes = trigger().className;
    expect(classes).toContain('justify-between');
    // The Button base sets justify-center; tailwind-merge must resolve in our favour.
    expect(classes).not.toContain('justify-center');

    // Value first, chevron last.
    const [first] = [...trigger().children];
    expect(first.tagName).toBe('SPAN');
    expect(first.textContent).toBe('Marketing');
    expect(trigger().lastElementChild?.tagName.toLowerCase()).toBe('svg');
  });

  it('keeps its layout classes when a parent passes className', () => {
    // PopoverTrigger/DrawerTrigger pass `className` down via asChild. Spreading it last used
    // to replace the trigger's own classes outright, which silently dropped the alignment.
    act(() => {
      root.render(<ComboBox data={DATA} value="marketing" />);
    });

    // The rendered trigger carries PopoverTrigger's width classes *and* our alignment.
    expect(trigger().className).toContain('w-full');
    expect(trigger().className).toContain('justify-between');
  });
});

/**
 * Every call site spreads react-hook-form's `field` object straight in, so whatever the
 * component does not declare is silently dropped. `ref` and `onBlur` used not to be
 * declared, which cost the field its touched state, its `onBlur`-mode validation and the
 * node `shouldFocusError` needs after a failed submit.
 */
describe('ComboBox react-hook-form wiring', () => {
  it('forwards a ref to the trigger without displacing the popover trigger', () => {
    const ref = createRef<HTMLButtonElement>();
    act(() => {
      root.render(<ComboBox data={DATA} value={null} ref={ref} />);
    });

    expect(ref.current).toBe(trigger());
    // Radix composes its own ref with the child's, so the popover must still work.
    act(() => trigger().click());
    expect(document.querySelector('[data-slot="command-list"]')).not.toBeNull();
  });

  it('calls onBlur when the trigger loses focus', () => {
    let blurs = 0;
    act(() => {
      root.render(
        <ComboBox
          data={DATA}
          value={null}
          onBlur={(): void => {
            blurs += 1;
          }}
        />,
      );
    });

    act(() => {
      trigger().focus();
      trigger().blur();
    });
    expect(blurs).toBe(1);
  });
});

/**
 * Searching (issue #4893). Options are keyed by UUID in real use, so the search must look at
 * labels only, ignore letter case, and keep the best matches in view as the query changes.
 */
describe('ComboBox search', () => {
  const ENTITIES = [
    { value: '3f2a8c1e-0000-4000-8000-00000000abcd', label: 'Google Ltd' },
    { value: '9b1d4e7a-0000-4000-8000-000000000002', label: 'amazon web services' },
    { value: 'c0ffee00-0000-4000-8000-000000000003', label: 'Shufersal' },
    { value: 'deadbeef-0000-4000-8000-000000000004', label: 'Bezeq', description: 'Telecom' },
  ];

  function open(): void {
    act(() => {
      root.render(<ComboBox data={ENTITIES} value={null} />);
    });
    act(() => trigger().click());
  }

  function input(): HTMLInputElement {
    const found = document.querySelector<HTMLInputElement>('[cmdk-input]');
    if (!found) {
      throw new Error('no search input rendered');
    }
    return found;
  }

  function type(text: string): void {
    // Go through the native setter so React's controlled-input tracking sees the change.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(input(), text);
      input().dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function visibleLabels(): string[] {
    return [...document.querySelectorAll('[cmdk-item]')].map(
      item => item.querySelector('span')?.textContent ?? '',
    );
  }

  it('matches regardless of letter case', () => {
    open();
    const results = ['goo', 'GOO', 'Goo', 'AMAZON', 'shuf', 'SHUF'].map(query => {
      type(query);
      return visibleLabels();
    });
    expect(results[0]).toEqual(['Google Ltd']);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(results[3]).toEqual(['amazon web services']);
    expect(results[4]).toEqual(['Shufersal']);
    expect(results[5]).toEqual(results[4]);
  });

  it('searches descriptions', () => {
    open();
    type('TELECOM');
    expect(visibleLabels()).toEqual(['Bezeq']);
  });

  it('does not match on the option id', () => {
    open();
    type('abcd');
    expect(visibleLabels()).toEqual([]);
    expect(document.body.textContent).toContain('No results found.');
  });

  it('scrolls the list back to the top when the search changes', () => {
    open();
    const list = document.querySelector<HTMLElement>('[data-slot="command-list"]');
    if (!list) {
      throw new Error('no command list rendered');
    }
    list.scrollTop = 120;
    type('e');
    expect(list.scrollTop).toBe(0);
  });

  it('selects the clicked option by its value', () => {
    const changes: Array<string | null> = [];
    act(() => {
      root.render(
        <ComboBox
          data={ENTITIES}
          value={null}
          onChange={(value): void => {
            changes.push(value);
          }}
        />,
      );
    });
    act(() => trigger().click());
    type('bez');
    const item = document.querySelector<HTMLElement>('[cmdk-item]');
    act(() => item?.click());
    expect(changes).toEqual(['deadbeef-0000-4000-8000-000000000004']);
  });
});
