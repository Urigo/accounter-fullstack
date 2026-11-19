import { runPipeline } from '../../src/pipeline.js';
import { RULES } from '../../src/validate/rules.js';
import { RULE_CASES } from './cases.js';

const OPTIONS = { today: () => '2024-06-30' };

describe.each(RULES.map(rule => [rule.id, rule] as const))('rule %s', (id, rule) => {
  const ruleCase = RULE_CASES[id];

  it('fail case yields exactly one issue of the rule, with the catalogued severity', () => {
    const issues = runPipeline(ruleCase.fail(), OPTIONS).issues.filter(i => i.ruleId === id);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe(rule.severity);
    if (ruleCase.path !== undefined) {
      expect(issues[0]?.path).toBe(ruleCase.path);
    }
  });

  it('pass case yields no issue of the rule and no error at all', () => {
    const issues = runPipeline(ruleCase.pass(), OPTIONS).issues;
    expect(issues.filter(i => i.ruleId === id)).toEqual([]);
    expect(issues.filter(i => i.severity === 'error')).toEqual([]);
  });
});

it('every RULES id is unique', () => {
  const ids = RULES.map(rule => rule.id);
  expect(new Set(ids).size).toBe(ids.length);
});
