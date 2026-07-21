import { searchChargesTool } from './charges.js';
import { listTagsTool, listTaxCategoriesTool } from './lookups.js';
import { ToolRegistry } from './registry.js';
import { balanceReportTool } from './reports.js';

/**
 * The process-wide registry of curated production tools. Tools register here as
 * they are added; the MCP transport lists and dispatches from this instance.
 */
export const toolRegistry = new ToolRegistry();

toolRegistry.register(searchChargesTool);
toolRegistry.register(listTagsTool);
toolRegistry.register(listTaxCategoriesTool);
toolRegistry.register(balanceReportTool);
