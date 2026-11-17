import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readmeRulesSection, renderRulesTable } from '../../scripts/render-rules-table.js';

const README = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const PACKAGE_NAME = '@accounter/opcn1214-generator';
const ENTRY = fileURLToPath(new URL('../../src/index.ts', import.meta.url));

/** Every TypeScript code block preceded by `<!-- test -->`, in README order. */
function testedSnippets(): Array<{ name: string; code: string }> {
  const snippets: Array<{ name: string; code: string }> = [];
  const pattern = /<!-- test -->\s*```ts\n([\s\S]*?)```/g;
  for (const match of README.matchAll(pattern)) {
    const before = README.slice(0, match.index);
    const heading = [...before.matchAll(/^## (.+)$/gm)].at(-1)?.[1] ?? 'README';
    snippets.push({ name: heading, code: match[1] ?? '' });
  }
  return snippets;
}

describe('README.md', () => {
  const snippets = testedSnippets();

  it('has the tested examples', () => {
    expect(snippets.map(snippet => snippet.name)).toEqual([
      'Quick start',
      'Error handling',
      'Parsing and batches',
      'Response file',
    ]);
  });

  describe('every <!-- test --> example runs', () => {
    let dir: string;
    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'opcn1214-readme-'));
    });
    afterAll(() => {
      rmSync(dir, { recursive: true, force: true });
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.each(snippets.map((snippet, index) => [snippet.name, index] as const))(
      '%s',
      async (_name, index) => {
        const snippet = snippets[index];
        expect(snippet?.code).toContain(`from '${PACKAGE_NAME}'`);
        // The examples import the published name; run them against the sources.
        const code = (snippet?.code ?? '').replaceAll(`'${PACKAGE_NAME}'`, JSON.stringify(ENTRY));
        const file = join(dir, `snippet-${index}.ts`);
        writeFileSync(file, code);
        vi.spyOn(console, 'log').mockImplementation(() => {});
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        await import(/* @vite-ignore */ pathToFileURL(file).href);
        expect(errors).not.toHaveBeenCalled();
      },
      30_000,
    );
  });

  it('holds the rule table rendered from RULES (yarn render:rules)', async () => {
    const table = await renderRulesTable();
    expect(readmeRulesSection(README)).toBe(`\n\n${table}\n`);
  }, 30_000);
});
