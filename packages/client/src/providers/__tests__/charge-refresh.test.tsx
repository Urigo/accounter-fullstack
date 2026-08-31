// @vitest-environment happy-dom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChargeRefreshProvider,
  useRefreshCharges,
  useRegisterChargeRefresh,
} from '../charge-refresh.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Stands in for a `ChargeRow`: publishes a refresh handler for as long as it's mounted. */
function Row({ chargeId, refresh }: { chargeId: string; refresh: () => void }): ReactElement {
  useRegisterChargeRefresh(chargeId, refresh);
  return <div />;
}

describe('charge refresh registry', () => {
  let container: HTMLDivElement;
  let root: Root;
  /** Captured from inside the provider, the way a mutation hook would call it. */
  let refreshCharges: (chargeIds: string[]) => void;

  function Consumer(): ReactElement {
    refreshCharges = useRefreshCharges();
    return <div />;
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(node: ReactElement): Promise<void> {
    await act(async () => {
      root.render(node);
    });
  }

  it('refreshes only the registered charges and ignores the rest', async () => {
    const first = vi.fn();
    const second = vi.fn();

    await render(
      <ChargeRefreshProvider>
        <Consumer />
        <Row chargeId="charge-1" refresh={first} />
        <Row chargeId="charge-2" refresh={second} />
      </ChargeRefreshProvider>,
    );

    // "charge-3" isn't rendered — callers pass whatever the mutation touched and expect the
    // registry to sort out what's on screen.
    await act(async () => refreshCharges(['charge-1', 'charge-3']));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('fires every registration for a charge rendered more than once', async () => {
    const first = vi.fn();
    const second = vi.fn();

    await render(
      <ChargeRefreshProvider>
        <Consumer />
        <Row chargeId="charge-1" refresh={first} />
        <Row chargeId="charge-1" refresh={second} />
      </ChargeRefreshProvider>,
    );

    await act(async () => refreshCharges(['charge-1']));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops refreshing a charge once its row unmounts', async () => {
    const refresh = vi.fn();

    await render(
      <ChargeRefreshProvider>
        <Consumer />
        <Row chargeId="charge-1" refresh={refresh} />
      </ChargeRefreshProvider>,
    );

    await render(
      <ChargeRefreshProvider>
        <Consumer />
      </ChargeRefreshProvider>,
    );

    await act(async () => refreshCharges(['charge-1']));

    expect(refresh).not.toHaveBeenCalled();
  });

  it('re-registers when a row hands over a new refresh handler', async () => {
    const stale = vi.fn();
    const fresh = vi.fn();

    await render(
      <ChargeRefreshProvider>
        <Consumer />
        <Row chargeId="charge-1" refresh={stale} />
      </ChargeRefreshProvider>,
    );

    // A row's refetch identity tracks urql's `executeQuery`, so it can change between renders.
    await render(
      <ChargeRefreshProvider>
        <Consumer />
        <Row chargeId="charge-1" refresh={fresh} />
      </ChargeRefreshProvider>,
    );

    await act(async () => refreshCharges(['charge-1']));

    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('is a no-op outside a provider instead of throwing', async () => {
    const refresh = vi.fn();

    await render(
      <>
        <Consumer />
        <Row chargeId="charge-1" refresh={refresh} />
      </>,
    );

    await act(async () => refreshCharges(['charge-1']));

    expect(refresh).not.toHaveBeenCalled();
  });
});
