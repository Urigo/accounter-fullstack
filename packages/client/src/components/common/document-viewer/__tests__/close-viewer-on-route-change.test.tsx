import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDocumentViewerStore, useDocumentViewer } from '../../../../hooks/use-document-viewer.js';
import { CloseViewerOnRouteChange } from '../close-viewer-on-route-change.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let navigate: NavigateFunction;

function NavigateProbe(): null {
  navigate = useNavigate();
  return null;
}

beforeEach(() => {
  resetDocumentViewerStore();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <StrictMode>
        <MemoryRouter initialEntries={['/documents?page=1']}>
          <NavigateProbe />
          <CloseViewerOnRouteChange />
        </MemoryRouter>
      </StrictMode>,
    ),
  );
  act(() =>
    useDocumentViewer
      .getState()
      .open({ id: 'doc-1', imageUrl: 'https://example.com/a.jpg', fileUrl: null, title: 'Doc' }),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('CloseViewerOnRouteChange', () => {
  it('keeps the viewer open on mount', () => {
    expect(useDocumentViewer.getState().current?.id).toBe('doc-1');
  });

  it('keeps the viewer open when only the search string changes', async () => {
    await act(async () => navigate('/documents?page=2'));
    expect(useDocumentViewer.getState().current?.id).toBe('doc-1');
  });

  it('closes the viewer when the pathname changes', async () => {
    await act(async () => navigate('/charges'));
    expect(useDocumentViewer.getState().current).toBeNull();
  });
});
