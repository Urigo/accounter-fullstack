import { act, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Form1214AmountsSectionFragmentDoc } from '../../../../../gql/graphql.js';
import type { FragmentType } from '../../../../../gql/index.js';
import { Form1214ReportProvider } from '../report-context.js';
import { Form1214AmountsSection } from '../sections/amounts-section.js';
import {
  buttonByText,
  byLabel,
  clickAndSettle,
  clickOn,
  describedText,
  leave,
  mountRoot,
  pressKey,
  typeInto,
} from './editor-test-dom.js';

type UpdateVariables = {
  year: number;
  input: { amountOverrides?: Array<{ code: string; amount: number }> | null };
};

const { updateMock, hookState } = vi.hoisted(() => ({
  updateMock: vi.fn<(variables: UpdateVariables, blockName: string) => Promise<boolean>>(),
  hookState: { fetching: false },
}));

vi.mock('../../../../../hooks/use-update-report-1214-profile.js', () => ({
  useUpdateReport1214Profile: () => ({
    updateReport1214Profile: updateMock,
    fetching: hookState.fetching,
  }),
}));

const YEAR = 2025;

type Override = { code: string; amount: number };

function report(overrides: Override[]): FragmentType<typeof Form1214AmountsSectionFragmentDoc> {
  return {
    id: 'report',
    profile: { id: 'profile', amountOverrides: overrides },
    amounts: [
      { code: '018', amount: 0, source: 'OVERRIDE', computedAmount: 500, label: 'Income' },
      { code: '030', amount: 12.5, source: 'COMPUTED', computedAmount: 12.5, label: 'Other' },
      { code: '165', amount: 2001, source: 'COMPUTED', computedAmount: 2001, label: 'R&D total' },
    ],
  } as unknown as FragmentType<typeof Form1214AmountsSectionFragmentDoc>;
}

const SAVED: Override[] = [{ code: '018', amount: 0 }];

let mounted: ReturnType<typeof mountRoot>;
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
  act(() => mounted.root.render(<Harness overrides={overrides} />));
}

const container = (): HTMLDivElement => mounted.container;
const input = (label: string): HTMLInputElement | null => byLabel(container(), label);
const button = (text: string): HTMLButtonElement => buttonByText(container(), text);

beforeEach(() => {
  mounted = mountRoot();
  refresh = vi.fn<() => void>();
  setDirty = vi.fn<(section: string, dirty: boolean) => void>();
  updateMock.mockReset();
  hookState.fetching = false;
});

afterEach(() => {
  mounted.unmount();
});

describe('Form1214AmountsSection', () => {
  it('shows code 165 read-only and the saved override of 0', () => {
    render(SAVED);
    expect(input('Override of code 165')).toBeNull();
    expect(byLabel(container(), 'Override code 165')).toBeNull();
    expect(container().textContent).toContain('From R&D investments');
    expect(input('Override of code 018')?.value).toBe('0');
    expect(button('Save').disabled).toBe(true);
  });

  it('saves the whole overrides list, keeping 0, and refreshes the report', async () => {
    render(SAVED);
    typeInto(input('Code of the new override')!, '263');
    typeInto(input('Amount of the new override')!, '-5');
    clickOn(button('Add override'));
    expect(setDirty).toHaveBeenLastCalledWith('amounts', true);

    updateMock.mockResolvedValue(true);
    await clickAndSettle(button('Save'));

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      {
        year: YEAR,
        input: {
          amountOverrides: [
            { code: '018', amount: 0 },
            { code: '263', amount: -5 },
          ],
        },
      },
      'amount overrides',
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setDirty).toHaveBeenLastCalledWith('amounts', false);
    // the saved override stays on screen until the refreshed report arrives
    expect(input('Override of code 263')?.value).toBe('-5');
  });

  it('overrides a computed code from its row, focusing the new input', async () => {
    render(SAVED);
    clickOn(byLabel<HTMLButtonElement>(container(), 'Override code 030')!);
    const amount = input('Override of code 030')!;
    expect(amount.value).toBe('12.5');
    expect(document.activeElement).toBe(amount);

    updateMock.mockResolvedValue(true);
    await clickAndSettle(button('Save'));
    expect(updateMock.mock.calls[0][0].input).toEqual({
      amountOverrides: [
        { code: '018', amount: 0 },
        { code: '030', amount: 12.5 },
      ],
    });
  });

  it('adds the pending override on Enter instead of saving the block', () => {
    render(SAVED);
    typeInto(input('Code of the new override')!, '263');
    const amount = input('Amount of the new override')!;
    typeInto(amount, '4');
    const event = pressKey(amount, 'Enter');

    expect(event.defaultPrevented).toBe(true);
    expect(input('Override of code 263')?.value).toBe('4');
    expect(input('Code of the new override')?.value).toBe('');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('removes an override, back to the computed amount, and focuses "Add override"', async () => {
    render(SAVED);
    clickOn(byLabel<HTMLButtonElement>(container(), 'Remove the override of code 018')!);
    expect(input('Override of code 018')).toBeNull();
    expect(document.activeElement).toBe(button('Add override'));

    updateMock.mockResolvedValue(true);
    await clickAndSettle(button('Save'));
    expect(updateMock.mock.calls[0][0].input).toEqual({ amountOverrides: [] });
  });

  it('keeps an API-set override of 165 read-only, round-trips it and lets it be removed', async () => {
    render([...SAVED, { code: '165', amount: 999 }]);
    expect(input('Override of code 165')).toBeNull();
    expect(container().textContent).toContain('999');

    typeInto(input('Override of code 018')!, '1');
    updateMock.mockResolvedValue(true);
    await clickAndSettle(button('Save'));
    expect(updateMock.mock.calls[0][0].input).toEqual({
      amountOverrides: [
        { code: '018', amount: 1 },
        { code: '165', amount: 999 },
      ],
    });

    clickOn(byLabel<HTMLButtonElement>(container(), 'Remove the override of code 165')!);
    await clickAndSettle(button('Save'));
    expect(updateMock.mock.calls[1][0].input).toEqual({
      amountOverrides: [{ code: '018', amount: 1 }],
    });
  });

  it('keeps the draft when the server rejects a code (a derived one), without refreshing', async () => {
    render(SAVED);
    typeInto(input('Code of the new override')!, '100');
    typeInto(input('Amount of the new override')!, '1');
    clickOn(button('Add override'));

    // The hook shows the server's message as a toast and resolves to false
    updateMock.mockResolvedValue(false);
    await clickAndSettle(button('Save'));

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(input('Override of code 100')?.value).toBe('1');
    expect(container().textContent).toContain('Unsaved changes');
    expect(setDirty).toHaveBeenLastCalledWith('amounts', true);
  });

  it('is not dirty once an edit is reverted', () => {
    render(SAVED);
    typeInto(input('Override of code 018')!, '10');
    expect(setDirty).toHaveBeenLastCalledWith('amounts', true);
    typeInto(input('Override of code 018')!, '0');
    expect(setDirty).toHaveBeenLastCalledWith('amounts', false);
    expect(button('Save').disabled).toBe(true);
  });

  it('refuses an override of code 165 with the error tied to the code input', () => {
    render(SAVED);
    const code = input('Code of the new override')!;
    typeInto(code, '165');
    typeInto(input('Amount of the new override')!, '1');
    clickOn(button('Add override'));
    expect(code.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(code)).toMatch(/R&D investments/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('shows a blank amount error once the field is left, tied to the field', async () => {
    render(SAVED);
    typeInto(input('Override of code 018')!, '');
    expect(input('Override of code 018')!.getAttribute('aria-invalid')).toBe('false');

    await leave(input('Override of code 018')!);
    expect(describedText(input('Override of code 018')!)).toContain(
      'Enter the amount as a number, or remove the override',
    );
  });

  it('validates on Save: shows the errors, focuses the first invalid field and sends nothing', async () => {
    render(SAVED);
    typeInto(input('Override of code 018')!, 'abc');
    expect(button('Save').disabled).toBe(false);
    await clickAndSettle(button('Save'));

    expect(updateMock).not.toHaveBeenCalled();
    const amount = input('Override of code 018')!;
    expect(amount.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(amount)).toContain('Enter the amount as a number');
    expect(document.activeElement).toBe(amount);
  });

  it('resets to a refreshed report only while it has no unsaved edits', () => {
    render(SAVED);
    render([{ code: '018', amount: 7 }]);
    expect(input('Override of code 018')?.value).toBe('7');

    typeInto(input('Override of code 018')!, '8');
    render([{ code: '018', amount: 9 }]);
    expect(input('Override of code 018')?.value).toBe('8');
  });
});
