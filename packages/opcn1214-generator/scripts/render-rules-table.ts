import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { RULES } from '../src/validate/rules.js';

/** The README holds the rendered table between these markers. */
export const RULES_START = '<!-- rules:start -->';
export const RULES_END = '<!-- rules:end -->';

export const README_URL = new URL('../README.md', import.meta.url);

const SEVERITY = { error: 'E', warning: 'W' } as const;

/** One markdown table cell: pipes escaped, whitespace collapsed. */
function cell(text: string): string {
  return text
    .replaceAll(/\s+/g, ' ')
    .trim()
    .replaceAll('|', String.raw`\|`);
}

/**
 * The rule catalogue (RULES, SPEC §10) as a markdown table, formatted with the repository's
 * prettier configuration for the README, so `yarn prettier --check` keeps it unchanged.
 */
export async function renderRulesTable(): Promise<string> {
  const rows = [
    '| Rule ID | Sev | Source | Scope | Description |',
    '| --- | --- | --- | --- | --- |',
    ...RULES.map(
      rule =>
        `| \`${rule.id}\` | ${SEVERITY[rule.severity]} | ${rule.source} | ${rule.scope} | ${cell(rule.description)} |`,
    ),
  ];
  const filepath = fileURLToPath(README_URL);
  const options = await resolveConfig(filepath);
  return format(`${rows.join('\n')}\n`, { ...options, filepath });
}

/** The text between the README markers (exclusive), or undefined when a marker is missing. */
export function readmeRulesSection(readme: string): string | undefined {
  const start = readme.indexOf(RULES_START);
  const end = readme.indexOf(RULES_END);
  if (start === -1 || end < start) {
    return undefined;
  }
  return readme.slice(start + RULES_START.length, end);
}

/** `readme` with the rendered `table` between the markers. */
export function withRulesTable(readme: string, table: string): string {
  const start = readme.indexOf(RULES_START);
  const end = readme.indexOf(RULES_END);
  if (start === -1 || end < start) {
    throw new Error(`README.md must contain ${RULES_START} followed by ${RULES_END}`);
  }
  return `${readme.slice(0, start + RULES_START.length)}\n\n${table}\n${readme.slice(end)}`;
}

// Run as a script (`yarn workspace @accounter/opcn1214-generator render:rules`): rewrites the rule
// table of README.md from RULES.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const readme = readFileSync(README_URL, 'utf8');
  writeFileSync(README_URL, withRulesTable(readme, await renderRulesTable()));
  console.log(`updated the rule table in ${README_URL.pathname}`);
}
