import { Opcn1214ParseError } from '../../src/errors.js';
import { parse1214 } from '../../src/index.js';
import type { ParseOptions } from '../../src/model/options.js';
import { runPipeline } from '../../src/pipeline.js';
import type { Issue } from '../../src/validate/issue.js';
import { RULES } from '../../src/validate/rules.js';
import { RULE_CASES, type RuleCase } from './cases.js';

const OPTIONS = { today: () => '2024-06-30' };

/** Issues of a parsed file: business issues are returned, structural ones thrown. */
function fileIssues(content: string | Uint8Array, options?: ParseOptions): readonly Issue[] {
  try {
    return parse1214(content, options).issues;
  } catch (error) {
    if (error instanceof Opcn1214ParseError) {
      return error.issues;
    }
    throw error;
  }
}

function issuesOf(ruleCase: RuleCase, which: 'fail' | 'pass'): readonly Issue[] {
  return ruleCase.kind === 'file'
    ? fileIssues(ruleCase[which](), ruleCase.options)
    : runPipeline(ruleCase[which](), OPTIONS).issues;
}

describe.each(RULES.map(rule => [rule.id, rule] as const))('rule %s', (id, rule) => {
  const ruleCase = RULE_CASES[id];

  it('fail case yields exactly one issue of the rule, with the catalogued severity', () => {
    const issues = issuesOf(ruleCase, 'fail').filter(i => i.ruleId === id);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe(rule.severity);
    if (ruleCase.path !== undefined) {
      expect(issues[0]?.path).toBe(ruleCase.path);
    }
  });

  it('pass case yields no issue of the rule and no error at all', () => {
    const issues = issuesOf(ruleCase, 'pass');
    expect(issues.filter(i => i.ruleId === id)).toEqual([]);
    expect(issues.filter(i => i.severity === 'error')).toEqual([]);
  });
});

it('every RULES id is unique', () => {
  const ids = RULES.map(rule => rule.id);
  expect(new Set(ids).size).toBe(ids.length);
});
