import { act, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Form1214RdInvestmentsSectionFragmentDoc } from '../../../../../gql/graphql.js';
import type { FragmentType } from '../../../../../gql/index.js';
import { Form1214ReportProvider } from '../report-context.js';
import { Form1214RdInvestmentsSection } from '../sections/rd-investments-section.js';
import {
  buttonByText,
  byLabel,
  clickAndSettle,
  isDisabled,
  mountRoot,
  typeInto,
} from './editor-test-dom.js';

type UpdateVariables = {
  year: number;
  input: {
    rdInvestments?: Array<{
      companyName: string;
      companyFileNumber?: string | null;
      investmentAmount: number;
    }> | null;
  };
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

type Investment = {
  companyName: string;
  companyFileNumber: string | null;
  investmentAmount: number;
};

function report(
  investments: Investment[],
): FragmentType<typeof Form1214RdInvestmentsSectionFragmentDoc> {
  return {
    id: 'report',
    profile: { id: 'profile', rdInvestments: investments },
  } as unknown as FragmentType<typeof Form1214RdInvestmentsSectionFragmentDoc>;
}

const SAVED: Investment[] = [
  { companyName: 'מו"פ בע"מ', companyFileNumber: '512345678', investmentAmount: 1000.4 },
  { companyName: 'Lab Ltd', companyFileNumber: null, investmentAmount: 1000.5 },
];

let mounted: ReturnType<typeof mountRoot>;
let refresh: ReturnType<typeof vi.fn<() => void>>;
let setDirty: ReturnType<typeof vi.fn<(section: string, dirty: boolean) => void>>;

function Harness({ investments }: { investments: Investment[] }): ReactElement {
  return (
    <Form1214ReportProvider year={YEAR} refresh={refresh} setDirty={setDirty}>
      <Form1214RdInvestmentsSection data={report(investments)} />
    </Form1214ReportProvider>
  );
}

function render(investments: Investment[]): void {
  act(() => mounted.root.render(<Harness investments={investments} />));
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

describe('Form1214RdInvestmentsSection', () => {
  it('shows the code 165 total, each amount rounded to whole shekels, and follows edits', () => {
    render(SAVED);
    expect(container().textContent).toContain('Total (code 165)');
    expect(container().textContent).toContain('2,001');
    typeInto(input('R&D investment 2 amount')!, '-0.6');
    expect(container().textContent).toContain('999');
  });

  it('hints at the form limit of 5 without blocking more', () => {
    render(SAVED);
    expect(container().textContent).not.toContain('room for 5');
    const six = Array.from({ length: 6 }, (_, index) => ({
      companyName: `Company ${index + 1}`,
      companyFileNumber: null,
      investmentAmount: 1,
    }));
    render(six);
    expect(container().textContent).toContain('The form has room for 5 R&D investments');
  });

  it('sends a missing file number as null and keeps a negative amount', async () => {
    render(SAVED);
    typeInto(input('R&D investment 1 file number')!, '');
    typeInto(input('R&D investment 1 amount')!, '-250');
    updateMock.mockResolvedValue(true);
    await clickAndSettle(button('Save'));
    expect(updateMock).toHaveBeenCalledWith(
      {
        year: YEAR,
        input: {
          rdInvestments: [
            { companyName: 'מו"פ בע"מ', companyFileNumber: null, investmentAmount: -250 },
            { companyName: 'Lab Ltd', companyFileNumber: null, investmentAmount: 1000.5 },
          ],
        },
      },
      'R&D investments',
    );
  });

  it('disables the inputs, Save and Cancel while saving', () => {
    render(SAVED);
    typeInto(input('R&D investment 1 amount')!, '5');
    hookState.fetching = true;
    render(SAVED);
    expect(isDisabled(input('R&D investment 1 amount')!)).toBe(true);
    expect(isDisabled(button('Add investment'))).toBe(true);
    expect(button('Saving…').disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
  });

  it('keeps the draft dirty after a failed save, without refreshing', async () => {
    render(SAVED);
    typeInto(input('R&D investment 1 amount')!, '5');
    updateMock.mockResolvedValue(false);
    await clickAndSettle(button('Save'));
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(input('R&D investment 1 amount')?.value).toBe('5');
    expect(container().textContent).toContain('Unsaved changes');
    expect(setDirty).toHaveBeenLastCalledWith('rd-investments', true);
  });

  it('clears its dirty flag when it unmounts', () => {
    render(SAVED);
    typeInto(input('R&D investment 1 amount')!, '5');
    expect(setDirty).toHaveBeenLastCalledWith('rd-investments', true);
    act(() => mounted.root.render(<div />));
    expect(setDirty).toHaveBeenLastCalledWith('rd-investments', false);
  });
});
