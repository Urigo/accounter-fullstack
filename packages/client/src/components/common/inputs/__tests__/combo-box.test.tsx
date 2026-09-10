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
