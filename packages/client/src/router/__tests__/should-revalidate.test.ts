import type { ShouldRevalidateFunctionArgs } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { skipSameUrlRevalidation } from '../should-revalidate.js';

function args(
  current: string,
  next: string,
  extra: Partial<ShouldRevalidateFunctionArgs> = {},
): ShouldRevalidateFunctionArgs {
  return {
    currentUrl: new URL(current, 'https://app.test'),
    nextUrl: new URL(next, 'https://app.test'),
    currentParams: {},
    nextParams: {},
    defaultShouldRevalidate: true,
    ...extra,
  } as ShouldRevalidateFunctionArgs;
}

describe('skipSameUrlRevalidation', () => {
  it.each<[string, ShouldRevalidateFunctionArgs, boolean]>([
    ['same URL (a state-only push, replace or Back)', args('/charges/c1', '/charges/c1'), false],
    ['same URL with search and hash', args('/charges/c1?a=1#x', '/charges/c1?a=1#x'), false],
    ['another search string', args('/charges/c1', '/charges/c1?a=1'), true],
    ['another charge', args('/charges/c1', '/charges/c2'), true],
    [
      'a form submission to the same URL',
      args('/charges/c1', '/charges/c1', { formMethod: 'POST' }),
      true,
    ],
    [
      "another URL where React Router wouldn't revalidate",
      args('/charges/c1', '/charges/c2', { defaultShouldRevalidate: false }),
      false,
    ],
  ])('%s', (_, input, expected) => {
    expect(skipSameUrlRevalidation(input)).toBe(expected);
  });
});
