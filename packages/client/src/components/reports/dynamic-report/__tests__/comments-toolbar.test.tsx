import { act, createRef, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Client, CombinedError, Provider, type Exchange, type OperationResult } from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { map, pipe } from 'wonka';
import {
  DeleteTemplateConfirmation,
  type DeleteTemplateConfirmationRef,
} from '../dialogs/delete-template-confirmation.js';
import { Toolbar } from '../toolbar.js';
import type { Template } from '../utils/types.js';

vi.mock('sonner', () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  document.body.innerHTML = '';
});

const noop = (): void => {};

const TEMPLATE: Template = {
  id: 'owner-1-T',
  name: 'T',
  lastUpdated: new Date('2026-09-01T00:00:00Z'),
  isLocked: false,
  fromDate: '2026-01-01',
  toDate: '2026-12-31',
};

function renderToolbar(props: Partial<ComponentProps<typeof Toolbar>> = {}): void {
  act(() =>
    root.render(
      <Toolbar
        fromDate="2026-01-01"
        toDate="2026-12-31"
        onFromDateChange={noop}
        onToDateChange={noop}
        owners={[]}
        selectedOwner="owner-1"
        onOwnerChange={noop}
        showZeroed={false}
        onShowZeroedChange={noop}
        reviewOnly={false}
        onReviewOnlyChange={noop}
        editMode={false}
        onEditModeChange={noop}
        isDirty={false}
        hasStagedApprovals={false}
        currentTemplate={TEMPLATE}
        onSelectTemplate={noop}
        onSaveAsNew={noop}
        onResave={noop}
        onSaveReview={noop}
        onRename={noop}
        onDuplicate={noop}
        onDelete={noop}
        onDownloadCSV={noop}
        onChangePeriod={noop}
        onRestoreDraftPeriod={noop}
        snapshots={[]}
        activeBaselineId={null}
        latestBaselineId={null}
        onBaselineChange={noop}
        {...props}
      />,
    ),
  );
}

const discussionsButton = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('button[data-discussions-button]');

describe('Toolbar: Discussions', () => {
  it('shows the open thread count and opens the list', () => {
    const onOpen = vi.fn<() => void>();
    renderToolbar({ discussions: { openCount: 2, disabledReason: null, onOpen } });
    const button = discussionsButton();
    expect(button?.textContent).toBe('Discussions · 2 open');
    act(() => button?.click());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('is disabled, with the reason, without a saved template', () => {
    const onOpen = vi.fn<() => void>();
    renderToolbar({
      currentTemplate: null,
      discussions: {
        openCount: 0,
        disabledReason: 'Save the template to start a discussion',
        onOpen,
      },
    });
    const button = discussionsButton();
    expect(button?.getAttribute('aria-disabled')).toBe('true');
    expect(button?.textContent).toBe('Discussions');
    // It stays focusable, so keyboard users can reach the tooltip, but does nothing.
    expect(button?.disabled).toBe(false);
    act(() => button?.click());
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('is not gated by the lock or the Edit switch', () => {
    renderToolbar({
      isLocked: true,
      editMode: false,
      currentTemplate: { ...TEMPLATE, isLocked: true },
      discussions: { openCount: 1, disabledReason: null, onOpen: noop },
    });
    expect(discussionsButton()?.hasAttribute('aria-disabled')).toBe(false);
  });
});

// ── DeleteTemplateConfirmation ─────────────────────────────────────────────────────

type Asked = { templateName: string; policy: string };

function mockClient(
  respond: (templateName: string) => OperationResult['data'] | Error,
  asked: Asked[],
) {
  const exchange: Exchange = () => operations$ =>
    pipe(
      operations$,
      map((operation): OperationResult => {
        const templateName = (operation.variables as { templateName: string }).templateName;
        if (operation.kind === 'query') {
          asked.push({ templateName, policy: operation.context.requestPolicy });
        }
        const response = respond(templateName);
        const base = { operation, extensions: undefined, hasNext: false, stale: false };
        return response instanceof Error
          ? { ...base, data: undefined, error: new CombinedError({ networkError: response }) }
          : { ...base, data: response, error: undefined };
      }),
    );
  return new Client({ url: '/graphql', exchanges: [exchange] });
}

async function openDeleteDialog(client: Client, template: Template): Promise<void> {
  const ref = createRef<DeleteTemplateConfirmationRef>();
  act(() =>
    root.render(
      <Provider value={client}>
        <DeleteTemplateConfirmation
          ref={ref}
          setSelectedTemplateName={noop}
          refetchAllTemplates={noop}
          currentTemplate={TEMPLATE}
          setCurrentTemplate={noop}
        />
      </Provider>,
    ),
  );
  await act(async () => {
    ref.current?.deleteTemplate(template);
  });
}

const threadsOf = (count: number) => ({
  dynamicReportThreads: Array.from({ length: count }, (_, i) => ({ id: `t${i}` })),
});

describe('DeleteTemplateConfirmation: threads', () => {
  it('says how many threads go with the template, looked up for that template', async () => {
    const asked: Asked[] = [];
    const other = { ...TEMPLATE, id: 'owner-1-Other', name: 'Other' };
    await openDeleteDialog(
      mockClient(() => threadsOf(3), asked),
      other,
    );
    expect(asked).toEqual([{ templateName: 'Other', policy: 'network-only' }]);
    expect(document.body.textContent).toContain(
      'Its 3 discussion threads will be deleted with it.',
    );
  });

  it('reads naturally for one thread', async () => {
    await openDeleteDialog(
      mockClient(() => threadsOf(1), []),
      TEMPLATE,
    );
    expect(document.body.textContent).toContain('Its discussion thread will be deleted with it.');
  });

  it('mentions no threads when there are none', async () => {
    await openDeleteDialog(
      mockClient(() => threadsOf(0), []),
      TEMPLATE,
    );
    expect(document.body.textContent).toContain('This action cannot be undone.');
    expect(document.body.textContent).not.toContain('discussion thread');
  });

  it('degrades to the plain confirmation when the lookup fails', async () => {
    await openDeleteDialog(
      mockClient(() => new Error('offline'), []),
      TEMPLATE,
    );
    expect(document.body.textContent).toContain('Are you sure you want to delete "T"?');
    expect(document.body.textContent).not.toContain('discussion thread');
  });
});
