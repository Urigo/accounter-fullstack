import { act, StrictMode, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resetDocumentViewerStore,
  useDocumentViewer,
  useSuspendDockedViewer,
} from '../use-document-viewer.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ active }: { active: boolean }): ReactElement {
  useSuspendDockedViewer(active);
  return <span>probe</span>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetDocumentViewerStore();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

function count(): number {
  return useDocumentViewer.getState().suspendCount;
}

describe('useSuspendDockedViewer', () => {
  it('a StrictMode double mount ends at one suspension, and unmount resumes', () => {
    act(() =>
      root.render(
        <StrictMode>
          <Probe active />
        </StrictMode>,
      ),
    );
    expect(count()).toBe(1);

    act(() => root.render(<StrictMode>{null}</StrictMode>));
    expect(count()).toBe(0);
  });

  it('follows `active`', () => {
    act(() => root.render(<Probe active={false} />));
    expect(count()).toBe(0);
    act(() => root.render(<Probe active />));
    expect(count()).toBe(1);
    act(() => root.render(<Probe active={false} />));
    expect(count()).toBe(0);
  });

  it('two surfaces suspend independently', () => {
    act(() =>
      root.render(
        <>
          <Probe active />
          <Probe active />
        </>,
      ),
    );
    expect(count()).toBe(2);
    act(() => root.render(<Probe active />));
    expect(count()).toBe(1);
  });
});
