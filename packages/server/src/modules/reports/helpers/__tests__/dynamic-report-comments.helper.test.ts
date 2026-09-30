import { GraphQLError } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  isCommentByUser,
  MAX_COMMENT_LENGTH,
  MAX_NODE_ID_LENGTH,
  MAX_NODE_LABEL_LENGTH,
  nodeKindFromDb,
  nodeKindToDb,
  validateAddCommentInput,
  validateCommentContent,
  visibleCommentContent,
} from '../dynamic-report-comments.helper.js';

const OWNER = '00000000-0000-0000-0000-0000000005a1';
const USER = '00000000-0000-4000-8000-0000000007b1';

const validInput = {
  templateName: 'Balance sheet',
  nodeId: '00000000-0000-0000-0000-0000000007a1',
  nodeKind: 'LEAF' as const,
  nodeLabel: 'Bank Hapoalim',
  content: 'Why did this move?',
  fromDate: '2025-01-01',
  toDate: '2025-12-31',
  scopeOwnerId: OWNER,
};

function rejectsWith(fn: () => unknown, message: RegExp) {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(GraphQLError);
  expect((caught as GraphQLError).extensions.code).toBe('BAD_USER_INPUT');
  expect((caught as GraphQLError).message).toMatch(message);
}

describe('validateAddCommentInput', () => {
  it('accepts a valid input unchanged', () => {
    expect(validateAddCommentInput(validInput)).toEqual(validInput);
  });

  it('trims the content', () => {
    const result = validateAddCommentInput({ ...validInput, content: '  \n\thello there \n ' });
    expect(result.content).toBe('hello there');
  });

  it('keeps inner whitespace and line breaks', () => {
    const result = validateAddCommentInput({ ...validInput, content: ' line 1\n\n  line 2 ' });
    expect(result.content).toBe('line 1\n\n  line 2');
  });

  it('rejects empty content', () => {
    rejectsWith(() => validateAddCommentInput({ ...validInput, content: '' }), /must not be empty/);
  });

  it('rejects whitespace-only content', () => {
    rejectsWith(
      () => validateAddCommentInput({ ...validInput, content: '   \n\t ' }),
      /must not be empty/,
    );
  });

  it('accepts content of exactly the maximum length', () => {
    const content = 'a'.repeat(MAX_COMMENT_LENGTH);
    expect(validateAddCommentInput({ ...validInput, content }).content).toBe(content);
  });

  it('rejects content over the maximum length', () => {
    rejectsWith(
      () => validateAddCommentInput({ ...validInput, content: 'a'.repeat(MAX_COMMENT_LENGTH + 1) }),
      /at most 10000/,
    );
  });

  it('measures the length after trimming', () => {
    const content = `  ${'a'.repeat(MAX_COMMENT_LENGTH)}  `;
    expect(validateAddCommentInput({ ...validInput, content }).content).toHaveLength(
      MAX_COMMENT_LENGTH,
    );
  });

  it('rejects an empty nodeId', () => {
    rejectsWith(() => validateAddCommentInput({ ...validInput, nodeId: '' }), /Node id/);
  });

  it('accepts a nodeId of exactly the maximum length', () => {
    const nodeId = 'x'.repeat(MAX_NODE_ID_LENGTH);
    expect(validateAddCommentInput({ ...validInput, nodeId }).nodeId).toBe(nodeId);
  });

  it('rejects an over-long nodeId', () => {
    rejectsWith(
      () => validateAddCommentInput({ ...validInput, nodeId: 'x'.repeat(MAX_NODE_ID_LENGTH + 1) }),
      /Node id must be at most 200/,
    );
  });

  it.each(['1', 'branch-1b0c7c1e-5b4c-4d5e-9f00-000000000001', `${OWNER}|4000`])(
    'accepts the node id shapes the client generates (%s)',
    nodeId => {
      expect(validateAddCommentInput({ ...validInput, nodeId }).nodeId).toBe(nodeId);
    },
  );

  it('rejects a non-string nodeId', () => {
    expect(() => validateAddCommentInput({ ...validInput, nodeId: 7 })).toThrow(GraphQLError);
  });

  it('rejects an unknown nodeKind', () => {
    expect(() => validateAddCommentInput({ ...validInput, nodeKind: 'leaf' })).toThrow(
      GraphQLError,
    );
  });

  it('accepts a BRANCH nodeKind', () => {
    expect(validateAddCommentInput({ ...validInput, nodeKind: 'BRANCH' }).nodeKind).toBe('BRANCH');
  });

  it('trims the label and accepts an empty one', () => {
    expect(validateAddCommentInput({ ...validInput, nodeLabel: '  Cash  ' }).nodeLabel).toBe(
      'Cash',
    );
    expect(validateAddCommentInput({ ...validInput, nodeLabel: '' }).nodeLabel).toBe('');
  });

  it('caps an over-long label instead of rejecting it', () => {
    const result = validateAddCommentInput({
      ...validInput,
      nodeLabel: 'L'.repeat(MAX_NODE_LABEL_LENGTH + 50),
    });
    expect(result.nodeLabel).toBe('L'.repeat(MAX_NODE_LABEL_LENGTH));
  });

  it('caps a label by code point, never splitting a surrogate pair', () => {
    const result = validateAddCommentInput({
      ...validInput,
      nodeLabel: '😀'.repeat(MAX_NODE_LABEL_LENGTH + 1),
    });
    expect(Array.from(result.nodeLabel)).toHaveLength(MAX_NODE_LABEL_LENGTH);
    expect(result.nodeLabel).toBe('😀'.repeat(MAX_NODE_LABEL_LENGTH));
  });

  it('rejects an empty template name', () => {
    rejectsWith(
      () => validateAddCommentInput({ ...validInput, templateName: '' }),
      /Template name must not be empty/,
    );
  });

  it.each(['2025-13-01', '2025-02-30', '2025/01/01', '25-01-01', '', 'yesterday'])(
    'rejects a malformed fromDate (%s)',
    fromDate => {
      rejectsWith(() => validateAddCommentInput({ ...validInput, fromDate }), /yyyy-mm-dd/);
    },
  );

  it('rejects a malformed toDate', () => {
    rejectsWith(
      () => validateAddCommentInput({ ...validInput, toDate: '2025-12-32' }),
      /yyyy-mm-dd/,
    );
  });

  it('rejects fromDate after toDate', () => {
    rejectsWith(
      () =>
        validateAddCommentInput({ ...validInput, fromDate: '2026-01-01', toDate: '2025-12-31' }),
      /fromDate must not be after toDate/,
    );
  });

  it('accepts a single-day period', () => {
    const result = validateAddCommentInput({
      ...validInput,
      fromDate: '2025-06-30',
      toDate: '2025-06-30',
    });
    expect(result.fromDate).toBe(result.toDate);
  });

  it('rejects a malformed scopeOwnerId', () => {
    rejectsWith(
      () => validateAddCommentInput({ ...validInput, scopeOwnerId: 'not-a-uuid' }),
      /Invalid UUID/,
    );
  });

  it('accepts a seeded, non-RFC scopeOwnerId', () => {
    const scopeOwnerId = '00000000-0000-0000-0000-0000000005a1';
    expect(validateAddCommentInput({ ...validInput, scopeOwnerId }).scopeOwnerId).toBe(
      scopeOwnerId,
    );
  });

  it('rejects unknown fields', () => {
    expect(() => validateAddCommentInput({ ...validInput, authorId: USER })).toThrow(GraphQLError);
  });

  it('reports every problem at once', () => {
    rejectsWith(
      () => validateAddCommentInput({ ...validInput, content: '', nodeId: '' }),
      /Comment must not be empty.*Node id|Node id.*Comment must not be empty/,
    );
  });
});

describe('validateCommentContent', () => {
  it('trims', () => {
    expect(validateCommentContent('  edited \n')).toBe('edited');
  });

  it('rejects empty and whitespace-only content', () => {
    rejectsWith(() => validateCommentContent(''), /must not be empty/);
    rejectsWith(() => validateCommentContent(' \n '), /must not be empty/);
  });

  it('enforces the same maximum as a new message', () => {
    expect(validateCommentContent('b'.repeat(MAX_COMMENT_LENGTH))).toHaveLength(MAX_COMMENT_LENGTH);
    rejectsWith(() => validateCommentContent('b'.repeat(MAX_COMMENT_LENGTH + 1)), /at most/);
  });
});

describe('node kind mapping', () => {
  it('maps the GraphQL enum to the column values and back', () => {
    expect(nodeKindToDb('LEAF')).toBe('leaf');
    expect(nodeKindToDb('BRANCH')).toBe('branch');
    expect(nodeKindFromDb('leaf')).toBe('LEAF');
    expect(nodeKindFromDb('branch')).toBe('BRANCH');
  });

  it('throws on a value the column cannot hold', () => {
    expect(() => nodeKindFromDb('LEAF')).toThrow(/Unknown dynamic report node kind/);
  });
});

describe('visibleCommentContent', () => {
  it('returns the text of a live message', () => {
    expect(visibleCommentContent({ content: 'hello', deleted_at: null })).toBe('hello');
  });

  it('returns null once the message is deleted', () => {
    expect(visibleCommentContent({ content: 'hello', deleted_at: new Date() })).toBeNull();
  });
});

describe('isCommentByUser', () => {
  it('is true for the author', () => {
    expect(isCommentByUser({ author_id: USER }, USER)).toBe(true);
  });

  it('is false for another user', () => {
    expect(isCommentByUser({ author_id: USER }, '00000000-0000-4000-8000-0000000007b2')).toBe(
      false,
    );
  });

  it('is false for a caller with no user id', () => {
    expect(isCommentByUser({ author_id: USER }, null)).toBe(false);
  });
});
