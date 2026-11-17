import { mkdirSync, writeFileSync } from 'node:fs';
import { renderLayoutModule } from './layout/render.js';
import { layoutModuleUrl, layoutYears, readLayoutSources } from './layout/sources.js';

// Regenerates src/layout/<year>/layout.generated.ts for every documentation/layout/<year>/.
for (const year of layoutYears()) {
  const target = layoutModuleUrl(year);
  mkdirSync(new URL('.', target), { recursive: true });
  writeFileSync(target, await renderLayoutModule(year, readLayoutSources(year)));
  console.log(`generated ${target.pathname}`);
}
