import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SecuritiesContextInput } from '../../../../gql/graphql.js';
import { UserContext, type UserInfo } from '../../../../providers/user-provider.js';
import { SecuritiesSettingsSection } from '../securities-settings-section.js';

const { useQueryMock, refetchMock, updateSecuritiesContextMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  refetchMock: vi.fn(),
  updateSecuritiesContextMock: vi.fn<
    (variables: { input: SecuritiesContextInput }) => Promise<unknown>
  >(),
}));

vi.mock('urql', () => ({ useQuery: useQueryMock }));

vi.mock('@/hooks/use-get-tax-categories.js', () => ({
  useGetTaxCategories: () => ({
    fetching: false,
    refresh: vi.fn(),
    taxCategories: [],
    selectableTaxCategories: [
      { value: 'tc-dividends', label: 'Dividends' },
      { value: 'tc-fees', label: 'Fees' },
      { value: 'tc-other', label: 'Other' },
    ],
  }),
}));

vi.mock('@/hooks/use-get-businesses.js', () => ({
  useGetBusinesses: () => ({
    fetching: false,
    refresh: vi.fn(),
    businesses: [],
    selectableBusinesses: [
      { value: 'business-securities', label: 'Foreign securities' },
      { value: 'business-other', label: 'Other business' },
    ],
  }),
}));

vi.mock('@/hooks/use-update-securities-context.js', () => ({
  useUpdateSecuritiesContext: () => ({
    fetching: false,
    updateSecuritiesContext: updateSecuritiesContextMock,
  }),
}));

type SelectStubProps = {
  data?: Array<{ value: string; label: string }>;
  value?: string | number | null;
  onChange: (value: never) => void;
  placeholder?: string;
};

/** A native select in place of the popover combo box, so a test can pick an option directly */
function SelectStub({ data = [], value, onChange, placeholder, numeric }: SelectStubProps & {
  numeric?: boolean;
}): ReactElement {
  return (
    <select
      aria-label={placeholder}
      value={value?.toString() ?? ''}
      onChange={event => {
        const selected = event.target.value || null;
        onChange((numeric && selected ? Number(selected) : selected) as never);
      }}
    >
      <option value="">{placeholder}</option>
      {data.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

vi.mock('../../../common/inputs/combo-box.js', () => ({
  ComboBox: (props: SelectStubProps) => <SelectStub {...props} />,
}));

vi.mock('../../../common/inputs/sort-code-select.js', () => ({
  SortCodeSelect: (props: SelectStubProps) => (
    <SelectStub
      {...props}
      numeric
      data={[
        { value: '880', label: 'Securities (880)' },
        { value: '990', label: 'Other (990)' },
      ]}
    />
  ),
}));

// the dialog's own flows are covered with the charge quick-fix; here only its trigger matters
vi.mock('../../../charges/securities-tax-category-dialog.js', async importOriginal => ({
  ...(await importOriginal<
    typeof import('../../../charges/securities-tax-category-dialog.js')
  >()),
  SecuritiesTaxCategoryDialog: ({ triggerLabel }: { triggerLabel?: string }) => (
    <button type="button">{triggerLabel}</button>
  ),
}));

const securitiesContext = {
  id: 'owner-securities-context',
  foreignSecuritiesBusiness: { id: 'business-securities', name: 'Foreign securities' },
  sortCode: { id: 'sort-code-880', key: 880, name: 'Securities' },
  taxCategories: [
    {
      id: 'owner-securities-FOREIGN_DIVIDEND_INCOME',
      key: 'FOREIGN_DIVIDEND_INCOME',
      taxCategory: { id: 'tc-dividends', name: 'Dividends' },
    },
    {
      id: 'owner-securities-FOREIGN_SECURITIES_FEES',
      key: 'FOREIGN_SECURITIES_FEES',
      taxCategory: { id: 'tc-fees', name: 'Fees' },
    },
    {
      id: 'owner-securities-LOCAL_DIVIDEND_INCOME',
      key: 'LOCAL_DIVIDEND_INCOME',
      taxCategory: null,
    },
  ],
};

function userInfo(role: string): UserInfo {
  return {
    username: 'user',
    context: {
      memberships: [{ businessId: 'owner', role }],
      activeReadScope: ['owner'],
      adminBusinessId: 'owner',
      defaultLocalCurrency: 'ILS',
      defaultCryptoConversionFiatCurrency: 'USD',
      financialAccountsBusinessesIds: [],
      foreignSecuritiesBusinessId: 'business-securities',
      locality: 'Israel',
    },
  };
}

/** Picks an option of a controlled select the way a user does, through React's change event */
function choose(select: HTMLSelectElement, value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('SecuritiesSettingsSection', () => {
  let container: HTMLDivElement;
  let root: Root;
  const setUserContext = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue([
      { data: { adminContext: { id: 'owner', securitiesContext } }, fetching: false },
      refetchMock,
    ]);
    refetchMock.mockReset();
    updateSecuritiesContextMock.mockReset();
    setUserContext.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (role: string, adminBusinessId = 'owner') =>
    act(() =>
      root.render(
        <UserContext.Provider value={{ userContext: userInfo(role), setUserContext }}>
          <SecuritiesSettingsSection adminBusinessId={adminBusinessId} />
        </UserContext.Provider>,
      ),
    );

  /** The setting rows by their label */
  const rows = () =>
    new Map(
      Array.from(container.querySelectorAll('[data-testid="securities-setting"]')).map(row => [
        row.querySelector('span')?.textContent,
        row,
      ]),
    );
  const selectOf = (label: string) => rows().get(label)!.querySelector('select')!;
  const button = (text: string) =>
    Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === text)!;

  it('shows the current configuration, with every securities key', () => {
    render('accountant');

    expect(selectOf('Foreign securities business').value).toBe('business-securities');
    expect(selectOf('Securities sort code').value).toBe('880');
    expect(selectOf('Foreign dividend income').value).toBe('tc-dividends');
    expect(selectOf('Foreign securities fees').value).toBe('tc-fees');
    expect(selectOf('Local dividend income').value).toBe('');
    // a key the server returned nothing for is listed too, unset
    expect(selectOf('Financial consultancy').value).toBe('');
    expect(rows().size).toBe(16);
    expect(container.textContent).toContain('does not regenerate existing ledgers');
    expect(button('Save Changes').disabled).toBe(true);
  });

  it('saves only the changed tax category', async () => {
    updateSecuritiesContextMock.mockResolvedValue({ ...securitiesContext });
    render('business_owner');

    choose(selectOf('Local dividend income'), 'tc-other');
    expect(button('Save Changes').disabled).toBe(false);
    await act(async () => button('Save Changes').click());

    expect(updateSecuritiesContextMock).toHaveBeenCalledTimes(1);
    expect(updateSecuritiesContextMock.mock.calls[0][0]).toEqual({
      input: { taxCategories: [{ key: 'LOCAL_DIVIDEND_INCOME', taxCategoryId: 'tc-other' }] },
    });
    expect(refetchMock).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
    // the business did not change, so the user context is left alone
    expect(setUserContext).not.toHaveBeenCalled();
  });

  it('sends null for a cleared setting and updates the user context for a new business', async () => {
    updateSecuritiesContextMock.mockResolvedValue({
      ...securitiesContext,
      foreignSecuritiesBusiness: { id: 'business-other', name: 'Other business' },
    });
    render('business_owner');

    act(() =>
      (rows().get('Foreign securities fees')!.querySelector(
        'button[aria-label="Clear Foreign securities fees"]',
      ) as HTMLButtonElement).click(),
    );
    choose(selectOf('Foreign securities business'), 'business-other');
    await act(async () => button('Save Changes').click());

    expect(updateSecuritiesContextMock.mock.calls[0][0]).toEqual({
      input: {
        foreignSecuritiesBusinessId: 'business-other',
        taxCategories: [{ key: 'FOREIGN_SECURITIES_FEES', taxCategoryId: null }],
      },
    });
    expect(setUserContext).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ foreignSecuritiesBusinessId: 'business-other' }),
      }),
    );
  });

  it('keeps the edits when the server rejects them', async () => {
    updateSecuritiesContextMock.mockResolvedValue(undefined);
    render('business_owner');

    choose(selectOf('Securities sort code'), '990');
    await act(async () => button('Save Changes').click());

    expect(updateSecuritiesContextMock.mock.calls[0][0]).toEqual({ input: { sortCode: 990 } });
    expect(selectOf('Securities sort code').value).toBe('990');
    expect(button('Save Changes').disabled).toBe(false);
    expect(refetchMock).not.toHaveBeenCalled();
  });

  it('does not save a change reverted to the stored value', () => {
    render('business_owner');

    choose(selectOf('Foreign dividend income'), 'tc-other');
    choose(selectOf('Foreign dividend income'), 'tc-dividends');

    expect(button('Save Changes').disabled).toBe(true);
  });

  it('offers to create each tax category', () => {
    render('business_owner');

    expect(rows().get('Foreign dividend income')!.textContent).toContain('Create');
  });

  it('is hidden from roles that may not change it, without querying', () => {
    render('employee');

    expect(container.innerHTML).toBe('');
    expect(useQueryMock).not.toHaveBeenCalled();
  });

  it("is hidden on another business's admin page", () => {
    render('business_owner', 'another-owner');

    expect(container.innerHTML).toBe('');
    expect(useQueryMock).not.toHaveBeenCalled();
  });
});
