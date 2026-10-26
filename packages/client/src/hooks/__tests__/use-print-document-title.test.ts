import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePrintDocumentTitle } from '../use-print-document-title.js';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function Probe({ title }: { title: string }) {
  usePrintDocumentTitle(title);
  return null;
}

describe('usePrintDocumentTitle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    document.title = 'Route title';
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (title: string) => act(() => root.render(React.createElement(Probe, { title })));

  it('leaves the title alone until the page is printed', () => {
    render('report-2026-H1');

    expect(document.title).toBe('Route title');
  });

  it('titles the page while it prints, and restores the title after', () => {
    render('report-2026-H1');

    window.dispatchEvent(new Event('beforeprint'));
    expect(document.title).toBe('report-2026-H1');

    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe('Route title');
  });

  it('prints under the latest title', () => {
    render('report-2026-H1');
    render('report-2026-H2');

    window.dispatchEvent(new Event('beforeprint'));
    expect(document.title).toBe('report-2026-H2');
    window.dispatchEvent(new Event('afterprint'));
  });

  it('restores the title when the page goes away mid-print', () => {
    render('report-2026-H1');
    window.dispatchEvent(new Event('beforeprint'));

    act(() => root.unmount());
    root = createRoot(container);

    expect(document.title).toBe('Route title');
  });
});
