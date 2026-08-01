import { listBusinessesTool } from './businesses.js';
import { searchChargesTool } from './charges.js';
import { listTagsTool, listTaxCategoriesTool } from './lookups.js';
import { ToolRegistry } from './registry.js';
import { balanceReportTool } from './reports.js';

/**
 * The process-wide registry of curated production tools. Tools register here as
 * they are added; the MCP transport lists and dispatches from this instance.
 */
export const toolRegistry = new ToolRegistry();

// Discovery first: `describe()` preserves registration order, so this is the
// first tool the model sees in `tools/list` — ordering is a real prompt
// -engineering lever for getting the model to scope its calls.
toolRegistry.register(listBusinessesTool);
toolRegistry.register(searchChargesTool);
toolRegistry.register(listTagsTool);
toolRegistry.register(listTaxCategoriesTool);
toolRegistry.register(balanceReportTool);
