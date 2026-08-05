import { listAccountsTool } from './accounts.js';
import { listBusinessMembershipsTool } from './businesses.js';
import { getChargesTool } from './charge-details.js';
import { searchChargesTool } from './charges.js';
import { getDocumentsTool } from './document-details.js';
import { incomeExpenseSummaryTool, profitAndLossTool, vatReportTool } from './financial-reports.js';
import { counterpartyTotalsTool, ledgerRecordsTool } from './ledger-reports.js';
import { listBusinessesTool, listTagsTool, listTaxCategoriesTool } from './lookups.js';
import { ToolRegistry } from './registry.js';
import { balanceReportTool } from './reports.js';
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

// Answers before rows.
//
// The report tools are registered ahead of the row-level ones because a model
// asked "how much did we make this year" will otherwise reach for
// `search_charges` and rebuild bookkeeping from raw rows — the exact failure
// this ordering is here to prevent. `list_accounts` leads them: knowing the
// account structure is what makes any transaction-level answer interpretable.
toolRegistry.register(listAccountsTool);
toolRegistry.register(incomeExpenseSummaryTool);
toolRegistry.register(profitAndLossTool);
toolRegistry.register(vatReportTool);
toolRegistry.register(counterpartyTotalsTool);

toolRegistry.register(searchChargesTool);
// Charge detail (by id) sits next to search: the model searches, then drills
// into specific charges — which nest their transactions and documents.
toolRegistry.register(getChargesTool);
toolRegistry.register(getTransactionsTool);
toolRegistry.register(getDocumentsTool);
// Record-level ledger detail sits with the other drill-down tools, after the
// aggregate that answers most questions about it.
toolRegistry.register(ledgerRecordsTool);
toolRegistry.register(listTagsTool);
toolRegistry.register(listTaxCategoriesTool);
// The full business directory sits with the other reference-data lookups.
toolRegistry.register(listBusinessesTool);
toolRegistry.register(balanceReportTool);
