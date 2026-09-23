import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimelessDateString } from '@/helpers/index.js';
import { DatePickerInput } from '../date-picker-input.js';

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

function input(): HTMLInputElement {
  const found = container.querySelector('input');
  if (!found) throw new Error('no input rendered');
  return found;
}

/** The calendar trigger — the only button the field renders. */
function calendarButton(): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>('button[aria-label="Select date"]');
  if (!found) throw new Error('no calendar trigger rendered');
  return found;
}

/** The popover portals to document.body, so look for the calendar grid there. */
function calendarIsOpen(): boolean {
  return document.body.querySelector('[role="dialog"], table') !== null;
}

describe('DatePickerInput when disabled', () => {
  // Disabling only the text input left the calendar as a live second way to change the value:
  // the trigger stayed clickable and picking a day fired onChange on a field shown as read-only.
  it('disables the calendar trigger, not just the text input', () => {
    act(() => {
      root.render(
        <DatePickerInput value={'2024-01-01' as TimelessDateString} onChange={() => {}} disabled />,
      );
    });

    expect(input().disabled).toBe(true);
    expect(calendarButton().disabled).toBe(true);
  });

  it('does not open the calendar when the trigger is clicked', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <DatePickerInput value={'2024-01-01' as TimelessDateString} onChange={onChange} disabled />,
      );
    });

    act(() => {
      calendarButton().click();
    });

    expect(calendarIsOpen()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves both controls live when not disabled', () => {
    act(() => {
      root.render(
        <DatePickerInput value={'2024-01-01' as TimelessDateString} onChange={() => {}} />,
      );
    });

    expect(input().disabled).toBe(false);
    expect(calendarButton().disabled).toBe(false);
  });
});
