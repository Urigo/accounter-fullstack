import { listBusinessMembershipsTool } from './businesses.js';
import { getChargesTool } from './charge-details.js';
import { searchChargesTool } from './charges.js';
import { getContractsTool } from './contracts.js';
import { getDocumentsTool } from './document-details.js';
import { uploadDocumentsTool } from './documents-write.js';
import { getLedgerRecordsTool } from './ledger.js';
import { listBusinessesTool, listTagsTool, listTaxCategoriesTool } from './lookups.js';
import { ToolRegistry } from './registry.js';
import { balanceReportTool } from './reports.js';
import { updateChargesTagsTool } from './tags-write.js';
import { explainTerminologyTool } from './terminology.js';
import { getTransactionsTool } from './transaction-details.js';

/**
 * The process-wide registry of curated production tools. Tools register here as
 * they are added; the MCP transport lists and dispatches from this instance.
 */
export const toolRegistry = new ToolRegistry();

// Discovery first: `describe()` preserves registration order, so this leads the
// curated tool list — ordering is a real prompt-engineering lever for getting
// the model to scope its calls.
//
// `dispatchMcpRequest` sends `[...listedTools, ...toolRegistry.describe()]`, and
// `listedTools` is now empty (the internal smoke tool is dispatchable but no
// longer advertised), so this is genuinely the first tool the model sees.
toolRegistry.register(listBusinessMembershipsTool);
// Vocabulary second: it is the other zero-cost orientation call (pure, unscoped,
// no upstream hop), and it is what stops the model reading `byBusinesses` as the
// owner predicate or summing INTERNAL/CONVERSION charges into a spend total.
// Ahead of the data tools so it is read before the filters it explains are used.
toolRegistry.register(explainTerminologyTool);
toolRegistry.register(searchChargesTool);
// Charge detail (by id) sits next to search: the model searches, then drills
// into specific charges — which nest their transactions and documents.
toolRegistry.register(getChargesTool);
toolRegistry.register(getTransactionsTool);
toolRegistry.register(getDocumentsTool);
// Ledger records are the accounting layer under a charge, so they follow the
// charge/transaction/document drill-down rather than sitting with the lookups.
toolRegistry.register(getLedgerRecordsTool);
toolRegistry.register(getContractsTool);
toolRegistry.register(listTagsTool);
toolRegistry.register(listTaxCategoriesTool);
// The full business directory sits with the other reference-data lookups.
toolRegistry.register(listBusinessesTool);
toolRegistry.register(balanceReportTool);

// Write tools last. Registration order is the order the model sees, and reads
// are what it should reach for first — a tool that changes data should not be
// the first thing in the list. These are also hidden entirely unless
// `MCP_ENABLE_WRITE_TOOLS=1`, so on a default deployment the list ends above.
toolRegistry.register(updateChargesTagsTool);
toolRegistry.register(uploadDocumentsTool);
