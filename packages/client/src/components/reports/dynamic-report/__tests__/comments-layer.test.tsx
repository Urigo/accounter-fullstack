import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from 'sonner';
import {
  Client,
  CombinedError,
  Provider,
  useQuery,
  type Exchange,
  type Operation,
  type OperationResult,
} from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromPromise, fromValue, mergeMap, pipe } from 'wonka';
import { DynamicReportTemplateDocument } from '../../../../gql/graphql.js';
import {
  useCommentsLayer,
  type CommentsLayer,
  type CommentsLayerInput,
  type ThreadData,
} from '../hooks/use-comments-layer.js';
import type { CustomData, FlatNode } from '../utils/types.js';

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── fixtures ────────────────────────────────────────────────────────────────────

const FROM = '2026-01-01';
const TO = '2026-06-30';
const OWNER = 'owner-1';

function leaf(id: string, parent: string, extra: Partial<CustomData> = {}): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value: 1, ...extra },
  };
}

function branch(id: string, parent: string): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Branch ${id}`,
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: false },
  };
}

// report
// ├─ A (closed)
// │  └─ A1 (closed)
// │     └─ a1
// ├─ B
// │  └─ b1
// └─ h (hidden: no activity in the period)
const reportTree = [
  branch('A', 'report'),
  branch('A1', 'A'),
  leaf('a1', 'A1'),
  branch('B', 'report'),
  leaf('b1', 'B'),
  leaf('h', 'report', { isHidden: true }),
];

function thread(nodeId: string, extra: Partial<ThreadData> = {}): ThreadData {
  return {
    id: `t-${nodeId}`,
    nodeId,
    nodeKind: 'LEAF',
    nodeLabel: `Label ${nodeId}`,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    resolvedAt: null,
    resolvedBy: null,
    messages: [
      {
        id: `m-${nodeId}`,
        content: 'Hello',
        createdAt: new Date('2026-09-01T10:00:00Z'),
        editedAt: null,
        deletedAt: null,
        author: 'Dana',
        isMine: true,
        fromDate: FROM,
        toDate: TO,
        scopeOwnerId: OWNER,
      },
    ],
    ...extra,
  };
}

// ── mock client ───────────────────────────────────────────────────────────────────

type Recorded = { name: string; kind: string; policy: string; variables: Record<string, unknown> };

type MockServer = {
  threads: Record<string, ThreadData[]>;
  /** Makes the next addDynamicReportComment fail with this message. */
  failNextPost?: string;
  /** Holds addDynamicReportComment responses back until it resolves. */
  postGate?: Promise<void>;
};

function operationName(operation: Operation): string {
  const definition = operation.query.definitions[0];
  return definition?.kind === 'OperationDefinition' ? (definition.name?.value ?? '') : '';
}

function mockClient(server: MockServer, log: Recorded[]): Client {
  function respond(operation: Operation): OperationResult {
    const name = operationName(operation);
    const variables = (operation.variables ?? {}) as Record<string, unknown>;
    // Teardowns aren't requests.
    if (operation.kind === 'query' || operation.kind === 'mutation')
      log.push({
        name,
        kind: operation.kind,
        policy: operation.context.requestPolicy,
        variables,
      });
    const base = { operation, extensions: undefined, hasNext: false, stale: false };
    switch (name) {
      case 'DynamicReportThreads':
        return {
          ...base,
          data: {
            dynamicReportThreads: server.threads[variables['templateName'] as string] ?? [],
          },
          error: undefined,
        };
      case 'DynamicReportTemplate':
        return {
          ...base,
          data: {
            dynamicReport: {
              id: 'owner-1-T',
              name: 'T',
              isLocked: false,
              updated: new Date('2026-07-01T00:00:00Z'),
              fromDate: FROM,
              toDate: TO,
              snapshots: [],
              template: [],
            },
          },
          error: undefined,
        };
      case 'AddDynamicReportComment': {
        if (server.failNextPost) {
          const message = server.failNextPost;
          server.failNextPost = undefined;
          return {
            ...base,
            data: undefined,
            error: new CombinedError({
              graphQLErrors: [{ message, extensions: { code: 'NOT_FOUND' } }],
            }),
          };
        }
        const input = variables['input'] as { nodeId: string };
        return {
          ...base,
          data: {
            addDynamicReportComment: {
              id: `t-${input.nodeId}`,
              nodeId: input.nodeId,
              resolvedAt: null,
            },
          },
          error: undefined,
        };
      }
      case 'SetDynamicReportThreadResolved':
        return {
          ...base,
          data: {
            setDynamicReportThreadResolved: {
              id: variables['threadId'],
              resolvedAt: variables['resolved'] ? new Date() : null,
            },
          },
          error: undefined,
        };
      default:
        return {
          ...base,
          data: undefined,
          error: new CombinedError({ networkError: new Error(name) }),
        };
    }
  }
  const exchange: Exchange = () => operations$ =>
    pipe(
      operations$,
      mergeMap(operation => {
        const result = respond(operation);
        // A gated post answers only once the test opens the gate.
        return server.postGate && operationName(operation) === 'AddDynamicReportComment'
          ? fromPromise(server.postGate.then(() => result))
          : fromValue(result);
      }),
    );
  return new Client({ url: '/graphql', exchanges: [exchange] });
}

// ── harness ─────────────────────────────────────────────────────────────────────

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.dismiss).mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const baseInput: CommentsLayerInput = {
  templateName: 'T',
  reportTree,
  fromDate: FROM,
  toDate: TO,
  scopeOwnerId: OWNER,
  reviewVisibility: null,
};

/**
 * Mounts useCommentsLayer next to the template query, as DynamicReport mounts them, so a test can
 * tell whether anything the layer does re-runs the template query.
 */
function renderLayer(client: Client) {
  const result = {} as { current: CommentsLayer };
  function Probe({ input }: { input: CommentsLayerInput }): null {
    useQuery({ query: DynamicReportTemplateDocument, variables: { name: 'T' } });
    result.current = useCommentsLayer(input);
    return null;
  }
  const render = (input: Partial<CommentsLayerInput> = {}): void =>
    act(() =>
      root.render(
        <Provider value={client}>
          <Probe input={{ ...baseInput, ...input }} />
        </Provider>,
      ),
    );
  return { result, render };
}

const templateRuns = (log: Recorded[]): number =>
  log.filter(entry => entry.name === 'DynamicReportTemplate').length;

// ── tests ───────────────────────────────────────────────────────────────────────

describe('useCommentsLayer: the threads query', () => {
  it('stays paused until a saved template is loaded, and comments are disabled meanwhile', () => {
    const log: Recorded[] = [];
    const { result, render } = renderLayer(mockClient({ threads: {} }, log));
    render({ templateName: null });
    expect(log.filter(entry => entry.name === 'DynamicReportThreads')).toEqual([]);
    expect(result.current.disabledReason).toBe('Save the template to start a discussion');
    expect(result.current.rowComments(reportTree[0]!, false)).toBeUndefined();

    render();
    expect(log.some(entry => entry.name === 'DynamicReportThreads')).toBe(true);
    expect(result.current.disabledReason).toBeNull();
    expect(result.current.rowComments(reportTree[0]!, false)).toBeDefined();
  });

  it('indexes the template’s threads and rolls them up to the rows', () => {
    const { result, render } = renderLayer(
      mockClient({ threads: { T: [thread('a1'), thread('h')] } }, []),
    );
    render();
    expect(result.current.openCount).toBe(2);
    expect(result.current.commentStats.get('A')?.openBelow).toBe(1);
    expect(result.current.rowComments(reportTree[0]!, false)?.openBelow).toBe(1);
    expect(result.current.detached.map(entry => entry.reason)).toEqual(['hidden-in-period']);
    expect(result.current.groups.open.map(t => t.nodeId)).toEqual(['a1']);
  });

  it('gives a ghost row its thread read-only, and an empty annotation without one', () => {
    const ghost = leaf('g', 'B');
    const { result, render } = renderLayer(mockClient({ threads: { T: [thread('g')] } }, []));
    render({ ghosts: [ghost] });
    expect(result.current.rowComments(ghost, true)).toMatchObject({
      own: { threadId: 't-g' },
      readOnly: true,
    });
    expect(result.current.rowComments(leaf('g2', 'B'), true)).toMatchObject({
      own: undefined,
      readOnly: true,
    });
    expect(result.current.detached).toMatchObject([{ reason: 'not-in-report', isGhost: true }]);
  });
});

describe('useCommentsLayer: posting', () => {
  it('posts with the view on screen, refetches only the threads, and never the template', async () => {
    const log: Recorded[] = [];
    const server: MockServer = { threads: { T: [] } };
    const { result, render } = renderLayer(mockClient(server, log));
    render();
    const templateRunsBefore = templateRuns(log);

    act(() => result.current.openThread('A1'));
    act(() => result.current.setDraft('  Why is this up?  '));
    server.threads['T'] = [thread('A1', { nodeKind: 'BRANCH' })];
    const logBefore = log.length;
    let posted = false;
    await act(async () => {
      posted = await result.current.postComment();
    });
    {
      expect(posted).toBe(true);
      const after = log.slice(logBefore);
      expect(after.map(entry => [entry.name, entry.kind])).toEqual([
        ['AddDynamicReportComment', 'mutation'],
        ['DynamicReportThreads', 'query'],
      ]);
      expect(after[0]?.variables).toEqual({
        input: {
          templateName: 'T',
          nodeId: 'A1',
          nodeKind: 'BRANCH',
          nodeLabel: 'Branch A1',
          content: 'Why is this up?',
          fromDate: FROM,
          toDate: TO,
          scopeOwnerId: OWNER,
        },
      });
      expect(after[1]?.policy).toBe('network-only');
      expect(templateRuns(log)).toBe(templateRunsBefore);
      expect(result.current.draft).toBe('');
      expect(result.current.activeNode?.thread?.id).toBe('t-A1');
      // No success toast; the loading one is dismissed.
      expect(toast.dismiss).toHaveBeenCalledWith('addDynamicReportComment-A1');
    }
  });

  it('keeps the draft and reports the failure when a post fails', async () => {
    const log: Recorded[] = [];
    const server: MockServer = { threads: { T: [] }, failNextPost: 'Template not found' };
    const { result, render } = renderLayer(mockClient(server, log));
    render();
    act(() => result.current.openThread('a1'));
    act(() => result.current.setDraft('Hello'));
    let posted = true;
    await act(async () => {
      posted = await result.current.postComment();
    });
    expect(posted).toBe(false);
    expect(result.current.draft).toBe('Hello');
    expect(result.current.sendError).toMatch(/wasn’t sent/);
    expect(vi.mocked(toast.error).mock.calls[0]?.[1]).toMatchObject({
      description: 'Template not found',
    });
    expect(
      log.filter(entry => entry.name === 'DynamicReportThreads' && entry.policy === 'network-only'),
    ).toEqual([]);
  });

  it('sends nothing for a whitespace-only draft', async () => {
    const log: Recorded[] = [];
    const { result, render } = renderLayer(mockClient({ threads: {} }, log));
    render();
    act(() => result.current.openThread('a1'));
    act(() => result.current.setDraft('   \n '));
    await act(async () => {
      expect(await result.current.postComment()).toBe(false);
    });
    expect(log.some(entry => entry.kind === 'mutation')).toBe(false);
  });

  it('makes a thread whose node left the report read-only', async () => {
    const log: Recorded[] = [];
    const { result, render } = renderLayer(mockClient({ threads: { T: [thread('gone')] } }, log));
    render();
    act(() => result.current.openThread('gone'));
    expect(result.current.activeNode).toMatchObject({
      label: 'Label gone',
      detachedReason: 'not-in-report',
    });
    expect(result.current.activeNode?.readOnlyReason).toMatch(/no longer in the report/);
    act(() => result.current.setDraft('Hello'));
    await act(async () => {
      expect(await result.current.postComment()).toBe(false);
    });
    expect(log.some(entry => entry.kind === 'mutation')).toBe(false);
  });

  it('lets a hidden leaf be posted to, flagged as hidden in the period', () => {
    const { result, render } = renderLayer(mockClient({ threads: { T: [thread('h')] } }, []));
    render();
    act(() => result.current.openThread('h'));
    expect(result.current.activeNode).toMatchObject({
      detachedReason: 'hidden-in-period',
      readOnlyReason: null,
    });
  });

  it('resolves the thread in the sheet and refetches the threads', async () => {
    const log: Recorded[] = [];
    const { result, render } = renderLayer(mockClient({ threads: { T: [thread('a1')] } }, log));
    render();
    act(() => result.current.openThread('a1'));
    await act(async () => {
      expect(await result.current.setResolved(true)).toBe(true);
    });
    const mutation = log.find(entry => entry.name === 'SetDynamicReportThreadResolved');
    expect(mutation?.variables).toEqual({ threadId: 't-a1', resolved: true });
    expect(log.at(-1)).toMatchObject({ name: 'DynamicReportThreads', policy: 'network-only' });
  });
});

describe('useCommentsLayer: reveal', () => {
  it('opens the ancestors of a revealed row and keeps every row shown with Needs review off', () => {
    const { result, render } = renderLayer(mockClient({ threads: { T: [thread('a1')] } }, []));
    render();
    expect(result.current.visibility).toBeNull();
    act(() => result.current.selectThread('a1'));
    expect(result.current.revealNodeId).toBe('a1');
    expect(result.current.sheet).toEqual({ mode: 'node', nodeId: 'a1' });
    expect(result.current.visibility?.visibleIds).toBeNull();
    expect(result.current.visibility?.forceOpenIds).toEqual(new Set(['A1', 'A']));
    // The nodes themselves are untouched.
    expect(reportTree.find(node => node.id === 'A')?.data.isOpen).toBe(false);
  });

  it('adds the revealed row to what Needs review shows', () => {
    const review = { visibleIds: new Set(['B', 'b1']), forceOpenIds: new Set(['B']) };
    const { result, render } = renderLayer(mockClient({ threads: { T: [thread('a1')] } }, []));
    render({ reviewVisibility: review });
    expect(result.current.visibility).toBe(review);
    act(() => result.current.selectThread('a1'));
    expect(result.current.visibility?.visibleIds).toEqual(new Set(['B', 'b1', 'a1', 'A1', 'A']));
    expect(result.current.visibility?.forceOpenIds).toEqual(new Set(['B', 'A1', 'A']));
  });

  it('reveals a ghost row through its ghost ancestors', () => {
    const ghosts = [branch('G', 'B'), leaf('g1', 'G')];
    const { result, render } = renderLayer(mockClient({ threads: { T: [thread('g1')] } }, []));
    render({ ghosts });
    act(() => result.current.selectThread('g1'));
    expect(result.current.visibility?.forceOpenIds).toEqual(new Set(['G', 'B']));
  });

  it('opens the thread without a reveal for a row that can’t be shown', () => {
    const { result, render } = renderLayer(mockClient({ threads: { T: [thread('h')] } }, []));
    render();
    act(() => result.current.selectThread('h'));
    expect(result.current.revealNodeId).toBeNull();
    expect(result.current.visibility).toBeNull();
    expect(result.current.sheet).toEqual({ mode: 'node', nodeId: 'h' });
  });

  it('scrolls the revealed row into view', () => {
    const row = document.createElement('div');
    row.dataset['nodeId'] = 'a1';
    row.dataset['treeId'] = 'report';
    const scrollIntoView = vi.fn<(options?: ScrollIntoViewOptions) => void>();
    row.scrollIntoView = scrollIntoView;
    document.body.append(row);
    try {
      const { result, render } = renderLayer(mockClient({ threads: { T: [thread('a1')] } }, []));
      render();
      act(() => result.current.selectThread('a1'));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      act(() => result.current.selectThread('a1'));
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    } finally {
      row.remove();
    }
  });

  it('keeps the revealed row on screen after the sheet closes', () => {
    const { result, render } = renderLayer(mockClient({ threads: { T: [thread('a1')] } }, []));
    render();
    act(() => result.current.selectThread('a1'));
    act(() => result.current.closeSheet());
    expect(result.current.sheet).toBeNull();
    expect(result.current.visibility?.forceOpenIds).toEqual(new Set(['A1', 'A']));
  });
});

describe('useCommentsLayer: drafts and the sheet', () => {
  it('keeps a draft per node', () => {
    const { result, render } = renderLayer(mockClient({ threads: {} }, []));
    render();
    act(() => result.current.openThread('a1'));
    act(() => result.current.setDraft('about a1'));
    act(() => result.current.openThread('b1'));
    expect(result.current.draft).toBe('');
    act(() => result.current.setDraft('about b1'));
    act(() => result.current.openThread('a1'));
    expect(result.current.draft).toBe('about a1');
  });

  it('clears drafts, the sheet and the reveal on a template switch', () => {
    const { result, render } = renderLayer(
      mockClient({ threads: { T: [thread('a1')], U: [] } }, []),
    );
    render();
    act(() => result.current.selectThread('a1'));
    act(() => result.current.setDraft('unsent'));
    expect(result.current.draft).toBe('unsent');

    render({ templateName: 'U' });
    expect(result.current.sheet).toBeNull();
    expect(result.current.revealNodeId).toBeNull();
    expect(result.current.visibility).toBeNull();
    expect(result.current.threads).toEqual([]);

    act(() => result.current.openThread('a1'));
    expect(result.current.draft).toBe('');

    // Coming back doesn't bring the old draft back either.
    render({ templateName: 'T' });
    act(() => result.current.openThread('a1'));
    expect(result.current.draft).toBe('');
  });

  it('switches between one node’s thread and every discussion', () => {
    const { result, render } = renderLayer(mockClient({ threads: {} }, []));
    render();
    act(() => result.current.openDiscussions());
    expect(result.current.sheet).toEqual({ mode: 'all' });
    expect(result.current.activeNode).toBeNull();
    act(() => result.current.openThread('b1'));
    expect(result.current.activeNode).toMatchObject({
      nodeId: 'b1',
      label: 'Entity b1',
      path: ['Branch B'],
      thread: null,
    });
    expect(result.current.rowComments(reportTree[4]!, false)?.isActive).toBe(true);
    act(() => result.current.closeSheet());
    expect(result.current.sheet).toBeNull();
  });
});

describe('useCommentsLayer: review fixes', () => {
  it('drops a previous reveal when the next thread has no row to reveal', () => {
    const { result, render } = renderLayer(
      mockClient({ threads: { T: [thread('a1'), thread('gone'), thread('h')] } }, []),
    );
    render();
    act(() => result.current.selectThread('a1'));
    expect(result.current.visibility?.forceOpenIds).toEqual(new Set(['A1', 'A']));

    // Not in the report.
    act(() => result.current.selectThread('gone'));
    expect(result.current.revealNodeId).toBeNull();
    expect(result.current.visibility).toBeNull();
    expect(result.current.sheet).toEqual({ mode: 'node', nodeId: 'gone' });
    expect(result.current.activeNode?.label).toBe('Label gone');

    // A hidden leaf, after another reveal.
    act(() => result.current.selectThread('a1'));
    act(() => result.current.selectThread('h'));
    expect(result.current.visibility).toBeNull();
    expect(result.current.sheet).toEqual({ mode: 'node', nodeId: 'h' });
  });

  /** Starts a gated post on T's a1, switches to U and writes a draft there on the same node id. */
  async function postAcrossTemplateSwitch(server: MockServer) {
    let openGate = (): void => {};
    server.postGate = new Promise<void>(resolve => {
      openGate = resolve;
    });
    const log: Recorded[] = [];
    const { result, render } = renderLayer(mockClient(server, log));
    render();
    act(() => result.current.openThread('a1'));
    act(() => result.current.setDraft('Hello'));
    let posted: Promise<boolean> = Promise.resolve(false);
    act(() => {
      posted = result.current.postComment();
    });
    expect(result.current.isSending).toBe(true);

    render({ templateName: 'U' });
    act(() => result.current.openThread('a1'));
    act(() => result.current.setDraft('Draft on U'));
    const logBefore = log.length;

    await act(async () => {
      openGate();
      await posted;
    });
    return { result, after: log.slice(logBefore), posted };
  }

  it('leaves the next template alone when a post lands after a template switch', async () => {
    const { result, after, posted } = await postAcrossTemplateSwitch({ threads: { T: [], U: [] } });
    expect(await posted).toBe(true);
    expect(result.current.draft).toBe('Draft on U');
    expect(result.current.sendError).toBeNull();
    expect(result.current.isSending).toBe(false);
    // Only the mutation's own response landed: no refetch, of the old template or the new one.
    expect(after.filter(entry => entry.name === 'DynamicReportThreads')).toEqual([]);
  });

  it('shows no send error on the next template when a post fails after a switch', async () => {
    const { result, after, posted } = await postAcrossTemplateSwitch({
      threads: { T: [], U: [] },
      failNextPost: 'Template not found',
    });
    expect(await posted).toBe(false);
    expect(result.current.draft).toBe('Draft on U');
    expect(result.current.sendError).toBeNull();
    expect(result.current.isSending).toBe(false);
    expect(after.filter(entry => entry.name === 'DynamicReportThreads')).toEqual([]);
  });
});
