// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider, type Client } from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeScriptedClient } from '../../../../../__tests__/helpers/scripted-client.js';
import { SimilarChargesByIdModal } from '../similar-charges-by-id-modal.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeClient(similarCharges: unknown[], operations: string[] = []): Client {
  return makeScriptedClient({ operations, fallback: () => ({ similarCharges }) });
}

describe('SimilarChargesByIdModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(node: React.ReactElement): Promise<void> {
    await act(async () => {
      root.render(node);
    });
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }
  }

  it('closes itself — through onOpenChange — when there is no criteria to review', async () => {
    const client = makeClient([]);
    const onOpenChange = vi.fn();
    const onClose = vi.fn();

    await render(
      <Provider value={client}>
        <SimilarChargesByIdModal
          chargeId="charge-1"
          open
          onOpenChange={onOpenChange}
          onClose={onClose}
        />
      </Provider>,
    );

    // Closing via `onOpenChange` is what lets the host reopen it for the next action.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes exactly once when the query finds nothing similar', async () => {
    const client = makeClient([]);
    const onOpenChange = vi.fn();
    const onClose = vi.fn();

    await render(
      <Provider value={client}>
        <SimilarChargesByIdModal
          chargeId="charge-1"
          description="Some description"
          open
          onOpenChange={onOpenChange}
          onClose={onClose}
        />
      </Provider>,
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('re-queries on each open instead of replaying the previous run', async () => {
    const operations: string[] = [];
    const client = makeClient([], operations);
    const onOpenChange = vi.fn();

    const view = (open: boolean, tagIds: { id: string }[]): React.ReactElement => (
      <Provider value={client}>
        <SimilarChargesByIdModal
          chargeId="charge-1"
          // A fresh array each render, the way the hosts build it.
          tagIds={tagIds.map(tag => ({ id: tag.id }))}
          open={open}
          onOpenChange={onOpenChange}
        />
      </Provider>
    );

    await render(view(true, [{ id: 'tag-1' }]));
    expect(operations.filter(name => name === 'SimilarCharges')).toHaveLength(1);

    // Closed, then opened again by a second action on the same host.
    await render(view(false, [{ id: 'tag-1' }]));
    await render(view(true, [{ id: 'tag-1' }]));
    expect(operations.filter(name => name === 'SimilarCharges')).toHaveLength(2);
  });
});
