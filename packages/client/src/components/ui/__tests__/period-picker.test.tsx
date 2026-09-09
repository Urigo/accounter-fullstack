// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MonthPicker, YearPicker } from '../period-picker.js';

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

/** Grid cells are buttons; the nav arrows are the only other buttons, and they carry aria-labels. */
function cells(): HTMLButtonElement[] {
  return [...container.querySelectorAll('button')].filter(b => !b.getAttribute('aria-label'));
}

function cell(label: string): HTMLButtonElement {
  const found = cells().find(b => b.textContent?.trim() === label);
  if (!found) {
    throw new Error(`no cell labelled "${label}" (have: ${cells().map(b => b.textContent).join()})`);
  }
  return found;
}

describe('YearPicker bounds', () => {
  it('keeps the boundary year selectable when minDate falls mid-year', () => {
    // The year 2010 still contains dates on or after 15 June 2010, so it must stay enabled.
    // Comparing against startOfMonth(minDate) instead of startOfYear(minDate) disabled it.
    act(() => {
      root.render(
        <YearPicker
          value={[]}
          onSelect={() => {}}
          minDate={new Date(2010, 5, 15)}
          defaultDate={new Date(2014, 0, 1)}
        />,
      );
    });

    expect(cell('2010').disabled).toBe(false);
    expect(cell('2009').disabled).toBe(true);
  });

  it('keeps the boundary year selectable when maxDate falls mid-year', () => {
    act(() => {
      root.render(
        <YearPicker
          value={[]}
          onSelect={() => {}}
          maxDate={new Date(2026, 5, 15)}
          defaultDate={new Date(2026, 0, 1)}
        />,
      );
    });

    expect(cell('2026').disabled).toBe(false);
    expect(cell('2027').disabled).toBe(true);
  });
});

describe('MonthPicker bounds', () => {
  it('keeps the boundary month selectable when minDate falls mid-month', () => {
    act(() => {
      root.render(
        <MonthPicker value={[]} onSelect={() => {}} minDate={new Date(2026, 5, 15)} />,
      );
    });

    // June contains dates on or after the 15th; May does not.
    expect(cell('Jun').disabled).toBe(false);
    expect(cell('May').disabled).toBe(true);
  });
});
