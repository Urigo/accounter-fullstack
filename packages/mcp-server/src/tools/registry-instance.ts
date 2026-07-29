import { searchChargesTool } from './charges.js';
import { ToolRegistry } from './registry.js';

/**
 * The process-wide registry of curated production tools. Tools register here as
 * they are added; the MCP transport lists and dispatches from this instance.
 */
export const toolRegistry = new ToolRegistry();

toolRegistry.register(searchChargesTool);
