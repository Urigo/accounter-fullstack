import { createBusinessTool } from './businesses-write.js';
import { listBusinessMembershipsTool } from './businesses.js';
import { getChargesTool } from './charge-details.js';
import { mergeChargesTool, updateChargeTool } from './charges-write.js';
import { searchChargesTool } from './charges.js';
import { listClientsTool } from './clients.js';
import { createContractTool } from './contracts-write.js';
import { getContractsTool } from './contracts.js';
import { getDocumentsTool } from './document-details.js';
import { deleteDocumentTool, updateDocumentTool } from './documents-edit-write.js';
import { uploadDocumentsTool } from './documents-write.js';
import { getLedgerRecordsTool } from './ledger.js';
import {
  listBusinessesTool,
  listSortCodesTool,
  listTagsTool,
  listTaxCategoriesTool,
} from './lookups.js';
import { ToolRegistry } from './registry.js';
import { balanceReportTool } from './reports/balance-report.js';
import { vatReportTool } from './reports/vat-report.js';
import { getSecurityExecutionsTool, listSecurityHoldingsTool } from './securities.js';
import { updateChargesTagsTool } from './tags-write.js';
import { explainTerminologyTool } from './terminology.js';
import { getTransactionsTool } from './transaction-details.js';
import { updateTransactionsTool } from './transactions-write.js';

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
// Clients immediately before contracts, for the same reason securities'
// portfolio precedes its executions: a contract is filtered by `clientIds`, and
// this is the only tool that enumerates them — so discovery is listed ahead of
// the tool that consumes it.
toolRegistry.register(listClientsTool);
toolRegistry.register(getContractsTool);
// Securities are their own drill-down, not reference data: the portfolio is the
// entry point and the execution history is what it drills into, so the pair sits
// together after the charge/ledger chain and ahead of the lookups.
toolRegistry.register(listSecurityHoldingsTool);
toolRegistry.register(getSecurityExecutionsTool);
toolRegistry.register(listTagsTool);
toolRegistry.register(listTaxCategoriesTool);
// Sort codes directly after tax categories: a sort code is the grouping a tax
// category belongs to, and the tax-category rows carry `sortCode.key` — so the
// tool that names those keys is listed where the model meets them.
toolRegistry.register(listSortCodesTool);
// The full business directory sits with the other reference-data lookups.
toolRegistry.register(listBusinessesTool);
toolRegistry.register(balanceReportTool);
// The VAT report is the other single-business report, so it sits with it.
toolRegistry.register(vatReportTool);

// Write tools last. Registration order is the order the model sees, and reads
// are what it should reach for first — a tool that changes data should not be
// the first thing in the list. These are also hidden entirely unless
// `MCP_ENABLE_WRITE_TOOLS=1`, so on a default deployment the list ends above.
toolRegistry.register(updateChargesTagsTool);
toolRegistry.register(uploadDocumentsTool);
// The review/matching writes, in the order a review uses them: fix the charge,
// fold duplicates into it, set counterparties on its rows, move or correct its
// documents, delete what should never have been one — and, when a counterparty
// is new, add it to the directory. Each is a thin wrapper over one upstream
// mutation; none of them is retried, and all are hidden behind the same flag.
toolRegistry.register(updateChargeTool);
toolRegistry.register(mergeChargesTool);
toolRegistry.register(updateTransactionsTool);
toolRegistry.register(updateDocumentTool);
toolRegistry.register(deleteDocumentTool);
toolRegistry.register(createBusinessTool);
// Recording a signed customer's billing agreement is the other write workflow;
// it keys on a client, which the read tools above enumerate.
toolRegistry.register(createContractTool);
