import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FragmentType } from '../../../../../gql/index.js';
import type { Form1214AmountsSectionFragmentDoc } from '../../../../../gql/graphql.js';

type UpdateVariables = {
  year: number;
  input: { amountOverrides?: Array<{ code: string; amount: number }> | null };
  blockName: string;
};

const { updateMock } = vi.hoisted(() => ({
  updateMock: vi.fn<(variables: UpdateVariables) => Promise<boolean>>(),
}));

vi.mock('../../../../../hooks/use-update-report-1214-profile.js', () => ({
  useUpdateReport1214Profile: () => ({
    updateReport1214Profile: updateMock,
    fetching: false,
    errorMessage: undefined,
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Form1214ReportProvider } from '../report-context.js';
import { Form1214AmountsSection } from '../sections/amounts-section.js';

const YEAR = 2025;

type Override = { code: string; amount: number };

function report(overrides: Override[]): FragmentType<typeof Form1214AmountsSectionFragmentDoc> {
  return {
    id: 'report',
    profile: { id: 'profile', amountOverrides: overrides },
    amounts: [
      { code: '018', amount: 0, source: 'OVERRIDE', computedAmount: 500, label: 'Income' },
      { code: '165', amount: 2001, source: 'COMPUTED', computedAmount: 2001, label: 'R&D total' },
    ],
  } as unknown as FragmentType<typeof Form1214AmountsSectionFragmentDoc>;
}

const SAVED: Override[] = [{ code: '018', amount: 0 }];

let container: HTMLDivElement;
let root: Root;
let refresh: ReturnType<typeof vi.fn<() => void>>;
let setDirty: ReturnType<typeof vi.fn<(section: string, dirty: boolean) => void>>;

function Harness({ overrides }: { overrides: Override[] }): ReactElement {
  return (
    <Form1214ReportProvider year={YEAR} refresh={refresh} setDirty={setDirty}>
      <Form1214AmountsSection data={report(overrides)} />
    </Form1214ReportProvider>
  );
}

function render(overrides: Override[]): void {
  act(() => root.render(<Harness overrides={overrides} />));
}

function button(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    candidate => candidate.textContent?.trim() === text,
  );
  if (!found) {
    throw new Error(`no "${text}" button`);
  }
  return found;
}

function input(label: string): HTMLInputElement | null {
  return container.querySelector(`input[aria-label="${label}"]`);
}

function type(element: HTMLInputElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function blur(element: HTMLInputElement): void {
  act(() => {
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

function click(element: HTMLElement): void {
  act(() => element.click());
}

function describedText(element: HTMLElement): string | null | undefined {
  const id = element.getAttribute('aria-describedby');
  return id ? container.querySelector(`#${id}`)?.textContent : null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  refresh = vi.fn<() => void>();
  setDirty = vi.fn<(section: string, dirty: boolean) => void>();
  updateMock.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Form1214AmountsSection', () => {
  it('shows code 165 read-only and the saved override of 0', () => {
    render(SAVED);
    expect(input('Override of code 165')).toBeNull();
    expect(container.querySelector('[aria-label="Override code 165"]')).toBeNull();
    expect(container.textContent).toContain('From R&D investments');
    expect(input('Override of code 018')?.value).toBe('0');
    expect(button('Save').disabled).toBe(true);
  });

  it('saves the whole overrides list, keeping 0, and refreshes the report', async () => {
    render(SAVED);
    type(input('Code of the new override')!, '263');
    type(input('Amount of the new override')!, '-5');
    click(button('Add override'));
    expect(setDirty).toHaveBeenLastCalledWith('amounts', true);

    updateMock.mockResolvedValue(true);
    await act(async () => button('Save').click());

    expect(updateMock).toHaveBeenCalledTimes(1);
    const [variables] = updateMock.mock.calls[0];
    expect(variables.year).toBe(YEAR);
    expect(variables.input).toEqual({
      amountOverrides: [
        { code: '018', amount: 0 },
        { code: '263', amount: -5 },
      ],
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setDirty).toHaveBeenLastCalledWith('amounts', false);
    // the saved override stays on screen until the refreshed report arrives
    expect(input('Override of code 263')?.value).toBe('-5');
  });

  it('removes an override, back to the computed amount', async () => {
    render(SAVED);
    click(container.querySelector<HTMLButtonElement>('[aria-label="Remove the override of code 018"]')!);
    expect(input('Override of code 018')).toBeNull();
    updateMock.mockResolvedValue(true);
    await act(async () => button('Save').click());
    expect(updateMock.mock.calls[0][0].input).toEqual({ amountOverrides: [] });
  });

  it('is not dirty once an edit is reverted', () => {
    render(SAVED);
    type(input('Override of code 018')!, '10');
    expect(setDirty).toHaveBeenLastCalledWith('amounts', true);
    type(input('Override of code 018')!, '0');
    expect(setDirty).toHaveBeenLastCalledWith('amounts', false);
    expect(button('Save').disabled).toBe(true);
  });

  it('refuses an override of code 165 with the error tied to the code input', () => {
    render(SAVED);
    const code = input('Code of the new override')!;
    type(code, '165');
    type(input('Amount of the new override')!, '1');
    click(button('Add override'));
    expect(code.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(code)).toMatch(/R&D investments/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('shows a blank amount error once the field is left, and keeps Save disabled', () => {
    render(SAVED);
    const amount = input('Override of code 018')!;
    type(amount, '');
    expect(button('Save').disabled).toBe(true);
    expect(amount.getAttribute('aria-describedby')).toBeNull();
    expect(container.textContent).toContain('Enter an amount for every override');

    blur(amount);
    expect(describedText(input('Override of code 018')!)).toBe(
      'Enter the amount as a number, or remove the override',
    );
    expect(container.textContent).toContain('Fix the highlighted fields before saving.');
  });
});
