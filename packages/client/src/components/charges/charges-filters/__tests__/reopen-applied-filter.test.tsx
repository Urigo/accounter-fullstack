import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChargeFilter } from '../../../../gql/graphql.js';
import { UserContext, type UserInfo } from '../../../../providers/user-provider.js';
import { buildDefaultFormValues } from '../constants.js';
import { ChargesFilters } from '../index.js';
import type { EntitiesData } from '../sections/entities-section.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Hoisted with the mock below, which reads it.
const { OWNER } = vi.hoisted(() => ({ OWNER: '0a7c6c3e-1111-4f1a-9a55-1b2c3d4e5f60' }));

// The pickers' options come from GraphQL; the date range doesn't need any of them.
vi.mock('../sections/entities-section.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../sections/entities-section.js')>();
  const data: EntitiesData = {
    owners: [{ value: OWNER, label: 'Admin Business' }],
    ownersFetching: false,
    soleOwnerId: null,
    financialEntities: [],
    financialEntitiesFetching: false,
    financialAccounts: [],
    financialAccountsFetching: false,
    tags: [],
    tagsFetching: false,
    businessTrips: [],
    businessTripsFetching: false,
    fetching: false,
  };
  return { ...actual, useEntitiesData: (): EntitiesData => data };
});

const userContext = { context: { adminBusinessId: OWNER } } as UserInfo;

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

/** Opens the filters dialog over `filter`, the way a charges screen renders it. */
function openDialog(filter: ChargeFilter, setFilter: (filter: ChargeFilter) => void): void {
  function Screen(): ReactElement {
    return (
      <UserContext.Provider value={{ userContext, setUserContext: (): void => void 0 }}>
        <ChargesFilters
          filter={filter}
          setFilter={setFilter}
          activePage={0}
          setPage={(): void => void 0}
          initiallyOpened
        />
      </UserContext.Provider>
    );
  }
  // A fresh root per open: the dialog's form only reads the applied filter when it mounts.
  act(() => root.unmount());
  root = createRoot(container);
  act(() => root.render(<Screen />));
}

/** The dialog portals to document.body. */
function dateValues(): [string | undefined, string | undefined] {
  return [
    document.querySelector<HTMLInputElement>('#from-any-date')?.value,
    document.querySelector<HTMLInputElement>('#to-any-date')?.value,
  ];
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    node => node.textContent?.trim() === label,
  );
  if (!found) throw new Error(`no "${label}" button`);
  return found;
}

function click(target: HTMLElement): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function apply(): Promise<void> {
  await act(async () => {
    button('Apply').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('reopening the charges filters over an applied filter', () => {
  const defaults = buildDefaultFormValues({ adminBusinessId: OWNER, withDefaultDateRange: true });

  it('keeps a cleared date range cleared', async () => {
    const setFilter = vi.fn<(filter: ChargeFilter) => void>();

    // First visit: no filter applied, so the dialog opens on the default range.
    openDialog({}, setFilter);
    expect(dateValues()).toEqual([defaults.fromAnyDate, defaults.toAnyDate]);

    click(button('No range'));
    expect(dateValues()).toEqual(['', '']);
    await apply();

    expect(setFilter).toHaveBeenCalledTimes(1);
    const applied = setFilter.mock.calls[0][0];
    expect(applied.fromAnyDate).toBeUndefined();
    expect(applied.toAnyDate).toBeUndefined();

    // The regression: the default range came back here, and a second Apply re-limited the
    // results to the last year.
    openDialog(applied, setFilter);
    expect(dateValues()).toEqual(['', '']);
  });

  it('restores the default date range on "Reset"', () => {
    openDialog({ byOwners: [OWNER], sortBy: defaults.sortBy }, vi.fn());
    expect(dateValues()).toEqual(['', '']);

    click(button('Reset'));

    expect(dateValues()).toEqual([defaults.fromAnyDate, defaults.toAnyDate]);
  });
});
