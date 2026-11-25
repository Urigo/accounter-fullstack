/** Stage 2 of SPEC §9.2: zod shape issues as input.shape issues. */
import type { z } from 'zod';
import { makeIssue, type Issue } from './issue.js';

type ZodIssue = z.ZodError['issues'][number];

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A zod path in the SPEC §9.1 grammar: `a.b`, `a[0]`, `amounts["018"]`; '' for the root. */
function formatPath(path: readonly PropertyKey[]): string {
  let text = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      text += `[${segment}]`;
    } else {
      const key = String(segment);
      if (IDENTIFIER.test(key)) {
        text += text === '' ? key : `.${key}`;
      } else {
        text += `[${JSON.stringify(key)}]`;
      }
    }
  }
  return text;
}

/** Only defined primitive offending values are carried, never whole objects or arrays. */
function primitive(value: unknown): { value?: unknown } {
  return value === undefined || (typeof value === 'object' && value !== null) ? {} : { value };
}

function hasInput(issue: ZodIssue): issue is ZodIssue & { input: unknown } {
  return 'input' in issue;
}

function convert(issue: ZodIssue): Issue[] {
  if (issue.code === 'unrecognized_keys') {
    // One zod issue at the parent lists every unknown key: one input.shape issue per key.
    const parent: unknown = hasInput(issue) ? issue.input : undefined;
    return issue.keys.map(key =>
      makeIssue('input.shape', {
        message: `Unknown property ${JSON.stringify(key)}.`,
        path: formatPath([...issue.path, key]),
        ...(typeof parent === 'object' && parent !== null
          ? primitive((parent as Record<string, unknown>)[key])
          : {}),
      }),
    );
  }
  return [
    makeIssue('input.shape', {
      message: issue.message,
      path: formatPath(issue.path),
      ...(hasInput(issue) ? primitive(issue.input) : {}),
      ...(issue.code === 'invalid_type' ? { expected: issue.expected } : {}),
    }),
  ];
}

/**
 * The input.shape issues of a failed parse (SPEC §9.2), paths in the SPEC §9.1 grammar. Offending
 * values are carried when the parse ran with `reportInput: true`.
 */
export function zodIssuesToIssues(error: z.ZodError): Issue[] {
  return error.issues.flatMap(convert);
}
