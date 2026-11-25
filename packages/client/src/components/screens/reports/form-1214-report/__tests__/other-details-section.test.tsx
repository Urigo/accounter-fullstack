import { act, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Form1214OtherDetailsSectionFragmentDoc } from '../../../../../gql/graphql.js';
import type { FragmentType } from '../../../../../gql/index.js';
import { Form1214ReportProvider } from '../report-context.js';
import { Form1214OtherDetailsSection } from '../sections/other-details-section.js';
import {
  buttonByText,
  clickAndSettle,
  clickOn,
  controlByVisibleLabel,
  describedText,
  formByLabel,
  mountRoot,
  typeInto,
} from './editor-test-dom.js';

type UpdateVariables = { year: number; input: Record<string, unknown> };

const { updateMock } = vi.hoisted(() => ({
  updateMock: vi.fn<(variables: UpdateVariables, blockName: string) => Promise<boolean>>(),
}));

vi.mock('../../../../../hooks/use-update-report-1214-profile.js', () => ({
  useUpdateReport1214Profile: () => ({ updateReport1214Profile: updateMock, fetching: false }),
}));

const YEAR = 2025;

type Profile = {
  attachments?: object | null;
  bankAccount?: object | null;
  otherTaxableIncome?: object | null;
  capitalGainsSummary?: object | null;
  qualifyingCompany?: object | null;
};

function report(profile: Profile): FragmentType<typeof Form1214OtherDetailsSectionFragmentDoc> {
  return {
    id: 'report',
    profile: {
      id: 'profile',
      attachments: null,
      bankAccount: null,
      otherTaxableIncome: null,
      capitalGainsSummary: null,
      qualifyingCompany: null,
      ...profile,
    },
  } as unknown as FragmentType<typeof Form1214OtherDetailsSectionFragmentDoc>;
}

let mounted: ReturnType<typeof mountRoot>;
let refresh: ReturnType<typeof vi.fn<() => void>>;
let setDirty: ReturnType<typeof vi.fn<(section: string, dirty: boolean) => void>>;

function Harness({ profile }: { profile: Profile }): ReactElement {
  return (
    <Form1214ReportProvider year={YEAR} refresh={refresh} setDirty={setDirty}>
      <Form1214OtherDetailsSection data={report(profile)} />
    </Form1214ReportProvider>
  );
}

function render(profile: Profile): void {
  act(() => mounted.root.render(<Harness profile={profile} />));
}

const block = (title: string): HTMLFormElement => formByLabel(mounted.container, title);
const field = (title: string, label: string): HTMLInputElement =>
  controlByVisibleLabel(block(title), label);

function answer(title: string, label: string, option: 'Yes' | 'No' | 'Not answered'): void {
  const group = block(title).querySelector(`[role="radiogroup"][aria-label="${label}"]`);
  if (!group) {
    throw new Error(`no "${label}" group`);
  }
  clickOn(buttonByText(group, option));
}

beforeEach(() => {
  mounted = mountRoot();
  refresh = vi.fn<() => void>();
  setDirty = vi.fn<(section: string, dirty: boolean) => void>();
  updateMock.mockReset();
  updateMock.mockResolvedValue(true);
});

afterEach(() => {
  mounted.unmount();
});

describe('Form1214OtherDetailsSection', () => {
  it('reports each block as its own dirty section', () => {
    render({});
    typeInto(field('Attachments', 'Donation receipts (code 070)'), '3');
    expect(setDirty).toHaveBeenCalledWith('other-details:attachments', true);
    expect(setDirty).not.toHaveBeenCalledWith('other-details:bankAccount', true);
  });

  it('saves each block on its own, leaving the other drafts alone', async () => {
    render({});
    typeInto(field('Attachments', 'Donation receipts (code 070)'), '3');
    typeInto(field('Changed bank account', 'Bank'), '12');
    await clickAndSettle(buttonByText(block('Attachments'), 'Save'));

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      { year: YEAR, input: { attachments: { donationReceiptsCount: 3 } } },
      'attachments',
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(field('Changed bank account', 'Bank').value).toBe('12');
    expect(block('Changed bank account').textContent).toContain('Unsaved changes');
  });

  it('needs the whole bank account, naming the missing fields', async () => {
    render({});
    typeInto(field('Changed bank account', 'Bank'), '12');
    await clickAndSettle(buttonByText(block('Changed bank account'), 'Save'));
    expect(updateMock).not.toHaveBeenCalled();
    expect(describedText(field('Changed bank account', 'Branch'))).toContain(
      'Required with the rest of the changed bank account',
    );

    typeInto(field('Changed bank account', 'Branch'), '345');
    typeInto(field('Changed bank account', 'Account'), '678');
    await clickAndSettle(buttonByText(block('Changed bank account'), 'Save'));
    expect(updateMock).toHaveBeenCalledWith(
      { year: YEAR, input: { bankAccount: { bank: '12', branch: '345', account: '678' } } },
      'changed bank account',
    );
  });

  it('sends a "No" answer as false', async () => {
    render({});
    answer('Qualifying company purchase', 'Purchased a qualifying company', 'No');
    await clickAndSettle(buttonByText(block('Qualifying company purchase'), 'Save'));
    expect(updateMock.mock.calls[0][0].input).toEqual({
      qualifyingCompany: { purchased: false },
    });
  });

  it('leaves an unchecked reason out of the block', async () => {
    render({
      capitalGainsSummary: {
        totalAppendicesCount: 2,
        untransmittedCount: 1,
        reasons: {
          lossOrNoGain: true,
          overFiveImprovementBalances: null,
          over14Appendices: null,
          other: true,
          otherText: 'סיבה',
        },
      },
    });
    const lossOrNoGain = controlByVisibleLabel<HTMLButtonElement>(
      block('Capital-gains appendices'),
      'Loss or no gain',
    );
    clickOn(lossOrNoGain);
    await clickAndSettle(buttonByText(block('Capital-gains appendices'), 'Save'));
    expect(updateMock.mock.calls[0][0].input).toEqual({
      capitalGainsSummary: {
        totalAppendicesCount: 2,
        untransmittedCount: 1,
        reasons: { other: true, otherText: 'סיבה' },
      },
    });
  });

  it('clears a block whose fields are all emptied', async () => {
    render({ attachments: { donationReceiptsCount: 2, withholdingCertificatesCount: null } });
    typeInto(field('Attachments', 'Donation receipts (code 070)'), '');
    await clickAndSettle(buttonByText(block('Attachments'), 'Save'));
    expect(updateMock).toHaveBeenCalledWith(
      { year: YEAR, input: { attachments: null } },
      'attachments',
    );
  });
});
