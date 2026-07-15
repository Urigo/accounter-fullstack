// @vitest-environment happy-dom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStableValue } from '../use-stable-value.js';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderStableValue<T>(): { render: (value: T) => T } {
  const seen: T[] = [];

  function Harness({ value }: { value: T }): null {
    seen.push(useStableValue(value));
    return null;
  }

  return {
    render(value: T): T {
      act(() => root.render(React.createElement(Harness, { value })));
      return seen[seen.length - 1] as T;
    },
  };
}

describe('useStableValue', () => {
  it('returns the same reference when a deeply-equal value is passed', () => {
    const harness = renderStableValue<{ id: string }[]>();

    const first = harness.render([{ id: 'a' }]);
    // New array + object identity, same content (simulating a urql refetch).
    const second = harness.render([{ id: 'a' }]);

    expect(second).toBe(first);
  });

  it('returns a new reference when the value actually changes', () => {
    const harness = renderStableValue<{ id: string }[]>();

    const first = harness.render([{ id: 'a' }]);
    const second = harness.render([{ id: 'b' }]);

    expect(second).not.toBe(first);
    expect(second).toEqual([{ id: 'b' }]);
  });

  it('tracks the latest value across a stable then changed sequence', () => {
    const harness = renderStableValue<number[]>();

    const first = harness.render([1, 2, 3]);
    const stable = harness.render([1, 2, 3]);
    const changed = harness.render([1, 2, 3, 4]);

    expect(stable).toBe(first);
    expect(changed).not.toBe(first);
    expect(changed).toEqual([1, 2, 3, 4]);
  });
});
