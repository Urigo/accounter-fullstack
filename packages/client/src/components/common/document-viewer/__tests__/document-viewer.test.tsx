import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentViewer } from '../document-viewer.js';
import type { DocumentViewerSource, Size } from '../types.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const A4: Size = { width: 2480, height: 3508 };
/** Scroll box size. With the 8px canvas padding the page gets 650 × 800. */
const PANE: Size = { width: 666, height: 816 };

const SOURCE: DocumentViewerSource = {
  imageUrl: 'https://res.cloudinary.com/demo/scan.jpg',
  fileUrl: 'https://res.cloudinary.com/demo/original.pdf',
  title: 'Tax Invoice 1042',
  subtitle: 'Acme Ltd → Your Company Ltd',
};

let container: HTMLDivElement;
let root: Root;
let hoverNone = false;
let resizeCallbacks: Array<() => void> = [];

beforeEach(() => {
  hoverNone = false;
  resizeCallbacks = [];
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(hover: none)' ? hoverNone : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(): void {
        resizeCallbacks.push(this.callback);
      }
      disconnect(): void {
        resizeCallbacks = resizeCallbacks.filter(cb => cb !== this.callback);
      }
      unobserve(): void {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});

  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function render(source: DocumentViewerSource = SOURCE, documentKey = 'doc-1'): void {
  act(() => root.render(<DocumentViewer source={source} documentKey={documentKey} />));
}

function scrollBox(): HTMLDivElement {
  const el = container.querySelector<HTMLDivElement>('[role="group"][aria-label="Document image"]');
  if (!el) {
    throw new Error('canvas not rendered');
  }
  return el;
}

function canvasImage(): HTMLImageElement {
  const img = scrollBox().querySelector('img');
  if (!img) {
    throw new Error('image not rendered');
  }
  return img;
}

function status(): string | undefined {
  return container.querySelector<HTMLElement>('[data-status]')?.dataset.status;
}

function setPane(size: Size): void {
  const box = scrollBox();
  Object.defineProperty(box, 'clientWidth', { configurable: true, value: size.width });
  Object.defineProperty(box, 'clientHeight', { configurable: true, value: size.height });
}

function loadImage(natural: Size = A4, pane: Size = PANE): void {
  setPane(pane);
  const img = canvasImage();
  Object.defineProperty(img, 'naturalWidth', { configurable: true, value: natural.width });
  Object.defineProperty(img, 'naturalHeight', { configurable: true, value: natural.height });
  act(() => {
    img.dispatchEvent(new Event('load'));
  });
}

function imageWidth(): number {
  return Number.parseFloat(canvasImage().style.width);
}

function button(label: string): HTMLButtonElement {
  const el = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    b => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
  );
  if (!el) {
    throw new Error(`button "${label}" not found`);
  }
  return el;
}

function click(el: HTMLElement): void {
  act(() => {
    el.click();
  });
}

function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('DocumentViewer', () => {
  it('shows the spinner and disables the toolbar before the image loads', () => {
    render();
    expect(status()).toBe('loading');
    expect(container.querySelector('[data-slot="document-viewer-spinner"]')).not.toBeNull();
    expect(button('Zoom in').disabled).toBe(true);
    expect(button('Zoom out').disabled).toBe(true);
  });

  it('renders the header, the image alt and the vaul opt-out', () => {
    render();
    expect(container.querySelector('h2')?.textContent).toBe('Tax Invoice 1042');
    expect(container.textContent).toContain('Acme Ltd → Your Company Ltd');
    expect(canvasImage().alt).toBe('Tax Invoice 1042');
    expect(container.querySelector('[data-slot="document-viewer"]')?.hasAttribute('data-vaul-no-drag')).toBe(true);
  });

  it('opens at Fit width, and switches to Fit page and 100%', () => {
    render();
    loadImage();
    expect(status()).toBe('ready');
    expect(container.querySelector('[data-slot="document-viewer-spinner"]')).toBeNull();
    expect(button('Zoom in').disabled).toBe(false);
    expect(imageWidth()).toBeCloseTo(650, 6);

    click(button('Fit page'));
    expect(imageWidth()).toBeCloseTo(2480 * (800 / 3508), 6);

    click(button('100%'));
    expect(imageWidth()).toBe(2480);

    click(button('Fit width'));
    expect(imageWidth()).toBeCloseTo(650, 6);
  });

  it('zooms with + and −, and from a typed percentage', () => {
    render();
    loadImage();

    click(button('Zoom in'));
    expect(imageWidth()).toBeCloseTo(650 * 1.25, 6);
    click(button('Zoom out'));
    expect(imageWidth()).toBeCloseTo(650, 6);

    click(button('Zoom 26%, click to type a value'));
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Zoom percentage"]');
    expect(input).not.toBeNull();
    typeInto(input!, '150');
    act(() => {
      input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(imageWidth()).toBeCloseTo(2480 * 1.5, 6);
    expect(button('Zoom 150%, click to type a value')).toBeDefined();
    // A custom zoom clears the fit selection.
    expect(button('Fit width').getAttribute('data-state')).toBe('off');
  });

  it('cancels a typed percentage with Escape', () => {
    render();
    loadImage();
    click(button('Zoom 26%, click to type a value'));
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Zoom percentage"]')!;
    typeInto(input, '300');
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('input[aria-label="Zoom percentage"]')).toBeNull();
    expect(imageWidth()).toBeCloseTo(650, 6);
  });

  it('zooms on ctrl+wheel and leaves a plain wheel to scroll', () => {
    render();
    loadImage();

    const zoomWheel = new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true });
    // happy-dom's WheelEvent drops `ctrlKey` from the init dictionary.
    Object.defineProperty(zoomWheel, 'ctrlKey', { value: true });
    act(() => {
      scrollBox().dispatchEvent(zoomWheel);
    });
    expect(zoomWheel.defaultPrevented).toBe(true);
    expect(imageWidth()).toBeCloseTo(650 * 1.25, 6);

    const plainWheel = new WheelEvent('wheel', { deltaY: -100, cancelable: true });
    act(() => {
      scrollBox().dispatchEvent(plainWheel);
    });
    expect(plainWheel.defaultPrevented).toBe(false);
    expect(imageWidth()).toBeCloseTo(650 * 1.25, 6);
  });

  it('shows an alert with Open original when the image fails to load', () => {
    render();
    act(() => {
      canvasImage().dispatchEvent(new Event('error'));
    });
    expect(status()).toBe('error');
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Couldn't load the document preview");
    expect(alert?.querySelector('a')?.getAttribute('href')).toBe(SOURCE.fileUrl);
  });

  it('links Open original to the image when there is no file', () => {
    render({ ...SOURCE, fileUrl: null });
    const links = [...container.querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(links).toEqual([SOURCE.imageUrl]);
  });

  it('renders no link for a javascript: URL', () => {
    render({ ...SOURCE, imageUrl: null, fileUrl: 'javascript:alert(1)' });
    expect(container.querySelector('a')).toBeNull();
  });

  it('says there is no preview for a file without an image', () => {
    render({ ...SOURCE, imageUrl: null });
    expect(container.textContent).toContain('No preview for this file');
    expect(container.querySelector('a')?.getAttribute('href')).toBe(SOURCE.fileUrl);
    expect(container.querySelector('[role="group"]')).toBeNull();
  });

  it('says nothing is attached when there is neither', () => {
    render({ ...SOURCE, imageUrl: null, fileUrl: null });
    expect(container.textContent).toContain('No image or file attached');
  });

  it('reveals the loupe size control and the loupe when the magnifier is on', () => {
    render();
    loadImage();
    expect(container.querySelector('[aria-label="Loupe size"]')).toBeNull();

    click(button('Magnifier'));
    expect(container.querySelector('[aria-label="Loupe size"]')).not.toBeNull();
    expect(button('Medium loupe').getAttribute('data-state')).toBe('on');
    expect(container.querySelector('[data-testid="document-viewer-loupe"]')).not.toBeNull();

    click(button('Large loupe'));
    expect(
      container.querySelector('[data-testid="document-viewer-loupe"]')?.classList.contains('size-80'),
    ).toBe(true);
  });

  it('hides the magnifier on touch-only devices', () => {
    hoverNone = true;
    render();
    loadImage();
    expect(container.querySelector('[aria-label="Magnifier"]')).toBeNull();
  });

  it('starts over when the document changes', () => {
    render();
    loadImage();
    expect(status()).toBe('ready');

    render(SOURCE, 'doc-2');
    expect(status()).toBe('loading');
    expect(button('Zoom in').disabled).toBe(true);
  });

  it('keeps the magnifier choice across a document change', () => {
    render();
    loadImage();
    click(button('Magnifier'));

    render(SOURCE, 'doc-2');
    loadImage();
    expect(button('Magnifier').getAttribute('data-state')).toBe('on');
  });

  it('re-applies the fit mode when the pane resizes, but keeps a custom zoom', () => {
    render();
    loadImage();
    expect(imageWidth()).toBeCloseTo(650, 6);

    setPane({ width: 1016, height: 816 });
    act(() => resizeCallbacks.forEach(cb => cb()));
    expect(imageWidth()).toBeCloseTo(1000, 6);

    click(button('Zoom in'));
    const custom = imageWidth();
    setPane({ width: 816, height: 816 });
    act(() => resizeCallbacks.forEach(cb => cb()));
    expect(imageWidth()).toBeCloseTo(custom, 6);
  });

  it('never upscales a small image at Fit width', () => {
    render();
    loadImage({ width: 300, height: 200 });
    expect(imageWidth()).toBe(300);
  });

  it('falls back to an unsized image with zoom disabled when the natural width is 0', () => {
    render();
    loadImage({ width: 0, height: 0 });
    expect(status()).toBe('unsized');
    expect(button('Zoom in').disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
