import { mkdirSync, writeFileSync } from 'node:fs';
import { renderCodesModule, renderLayoutModule } from './layout/render.js';
import {
  codesModuleUrl,
  latestLayoutYear,
  layoutModuleUrl,
  layoutYears,
  readLayoutSources,
} from './layout/sources.js';

function write(target: URL, source: string): void {
  mkdirSync(new URL('.', target), { recursive: true });
  writeFileSync(target, source);
  console.log(`generated ${target.pathname}`);
}

// Regenerates src/layout/<year>/layout.generated.ts for every documentation/layout/<year>/, and
// src/model/codes.generated.ts (year-independent code unions) from the newest year.
for (const year of layoutYears()) {
  write(layoutModuleUrl(year), await renderLayoutModule(year, readLayoutSources(year)));
}
const latest = latestLayoutYear();
write(codesModuleUrl(), await renderCodesModule(latest, readLayoutSources(latest)));
