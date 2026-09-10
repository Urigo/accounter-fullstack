// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { composeStories, setProjectAnnotations } from '@storybook/react-vite';
import * as previewAnnotations from '../../.storybook/preview.js';

/**
 * Runs every Storybook story as a test.
 *
 * Storybook's own `@storybook/addon-vitest` would normally do this (in a real browser, with
 * a11y assertions), but as of 10.6.0 it peer-requires vitest ^3 || ^4 and this repo is on
 * vitest 5. Portable stories give us the part that matters most in CI — every story is
 * mounted on every push, so a story that stops compiling or throws on render fails the
 * build instead of rotting silently. Visual and a11y checking stay manual in the Storybook
 * UI (`yarn workspace @accounter/client storybook`) until the addon supports vitest 5.
 *
 * This matters for the Mantine removal specifically: stories are the characterization
 * harness each migration PR is checked against, so they have to be known-good.
 */
setProjectAnnotations([previewAnnotations]);

// Vite turns this into a static map of story module path -> loader.
type StoryModule = Parameters<typeof composeStories>[0];
const storyModules = import.meta.glob<StoryModule>('../**/*.stories.tsx');

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

describe('storybook stories', () => {
  it('finds story files to run', () => {
    expect(Object.keys(storyModules).length).toBeGreaterThan(0);
  });

  for (const [path, load] of Object.entries(storyModules)) {
    describe(path, () => {
      // Generous: a single file can hold a dozen stories, each mounting a whole screen.
      it('renders every story without throwing', { timeout: 60_000 }, async () => {
        const composed = composeStories(await load());
        const names = Object.keys(composed);
        expect(names.length).toBeGreaterThan(0);

        for (const name of names) {
          const Story = composed[name as keyof typeof composed] as React.ComponentType;
          const bodyChildrenBefore = new Set(document.body.children);
          await act(async () => {
            root.render(<Story />);
          });
          // A story whose whole output is portaled — a Dialog, a Drawer — leaves the mount
          // node empty, so "did anything render" has to count the portal targets too.
          const portaled = [...document.body.children]
            .filter(child => child !== container && !bodyChildrenBefore.has(child))
            .map(child => child.outerHTML)
            .join('');
          expect(container.innerHTML.length + portaled.length, `story: ${name}`).toBeGreaterThan(0);
        }
      });
    });
  }
});
