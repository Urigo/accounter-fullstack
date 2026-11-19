import { useCallback, useMemo, type ReactElement } from 'react';
import { AlertTriangle, Check, Link2, Unlink, X } from 'lucide-react';
import {
  CreditcardBankChargeInfoFragmentDoc,
  CreditCardStatementLinkMethod,
  TransactionForTransactionsTableFieldsFragmentDoc,
  type CreditcardBankChargeInfoFragment,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { useDismissCreditCardStatements } from '../../../hooks/use-dismiss-credit-card-statements.js';
import { useLinkCreditCardStatements } from '../../../hooks/use-link-credit-card-statements.js';
import { useUnlinkCreditCardStatement } from '../../../hooks/use-unlink-credit-card-statement.js';
import { ChargeNavigateButton } from '../../common/index.js';
import {
  Account,
  Amount,
  Counterparty,
  DebitDate,
  Description,
  EventDate,
  SourceID,
} from '../../transactions-table/cells/index.js';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert.js';
import { Badge } from '../../ui/badge.js';
import { Button } from '../../ui/button.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment CreditcardBankChargeInfo on Charge {
    id
    __typename
    ... on CreditcardBankCharge {
      creditCardStatements {
        id
        currency
        debitDate
        linkMethod
        confirmed
        total {
          raw
          formatted
        }
        cardAccount {
          id
          name
          number
        }
        bankTransaction {
          id
          amount {
            raw
            formatted
          }
        }
        transactions {
          id
          ...TransactionForTransactionsTableFields
        }
      }
      creditCardStatementSuggestions {
        bankTransaction {
          id
          effectiveDate
          sourceDescription
          amount {
            raw
            formatted
          }
        }
        suggestions {
          reason
          previouslyRejected
          statements {
            id
            currency
            debitDate
            total {
              formatted
            }
            cardAccount {
              id
              name
              number
            }
          }
        }
      }
    }
  }
`;

type CreditcardCharge = Extract<
  CreditcardBankChargeInfoFragment,
  { __typename: 'CreditcardBankCharge' }
>;
type Statement = CreditcardCharge['creditCardStatements'][number];
type SuggestedStatement =
  CreditcardCharge['creditCardStatementSuggestions'][number]['suggestions'][number]['statements'][number];

type BankAmount = Statement['total'];
type BankDebitGroup = {
  bankTransactionId: string;
  amount: BankAmount;
  effectiveDate: string | null;
  description: string | null;
  statements: Statement[];
  suggestions: CreditcardCharge['creditCardStatementSuggestions'][number]['suggestions'];
};

/** What Link does to the statements already shown for the debit */
function suggestionsTitle(group: BankDebitGroup): string {
  if (group.statements.length === 0) {
    return 'Candidate statements';
  }
  if (group.statements.some(statement => !statement.confirmed)) {
    return 'Other candidates: Link stores the chosen statement instead of the unconfirmed match';
  }
  return 'Other candidates: Link adds the chosen statement to the linked ones';
}

const LINK_METHOD_LABELS: Record<CreditCardStatementLinkMethod, string> = {
  [CreditCardStatementLinkMethod.Reference]: 'Card reference',
  [CreditCardStatementLinkMethod.Amount]: 'Amount',
  [CreditCardStatementLinkMethod.Manual]: 'Manual',
};

const toCents = (value: number): number => Math.round(value * 100);

function statementKey(statement: Statement | SuggestedStatement) {
  return {
    cardAccountId: statement.cardAccount.id,
    currency: statement.currency,
    debitDate: statement.debitDate,
  };
}

function cardLabel(cardAccount: { name: string; number: string }): string {
  return cardAccount.name === cardAccount.number
    ? cardAccount.number
    : `${cardAccount.name} (${cardAccount.number})`;
}

function StatementTransactionsTable({ statement }: { statement: Statement }): ReactElement {
  const transactions = statement.transactions.map(raw =>
    getFragmentData(TransactionForTransactionsTableFieldsFragmentDoc, raw),
  );
  if (transactions.length === 0) {
    return (
      <p className="px-2 text-sm text-muted-foreground">
        No card transactions found for this statement yet.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event Date</TableHead>
          <TableHead>Debit Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Reference#</TableHead>
          <TableHead>Counterparty</TableHead>
          <TableHead>Charge</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map(transaction => {
          const extendedTransaction = {
            ...transaction,
            onUpdate: () => void 0,
            editTransaction: () => void 0,
            enableEdit: false,
            enableChargeLink: false,
          };
          return (
            <TableRow key={transaction.id}>
              <TableCell>
                <EventDate transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <DebitDate transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <Amount transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <Account transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <Description transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <SourceID transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <Counterparty transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <ChargeNavigateButton chargeId={transaction.chargeId} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

type Props = {
  chargeProps: FragmentType<typeof CreditcardBankChargeInfoFragmentDoc>;
  /** Called after a link change, to refresh the charge */
  onChange?: () => void;
};

export function CreditcardTransactionsInfo({ chargeProps, onChange }: Props): ReactElement {
  const charge = getFragmentData(CreditcardBankChargeInfoFragmentDoc, chargeProps);
  const { linkCreditCardStatements, fetching: linking } = useLinkCreditCardStatements();
  const { unlinkCreditCardStatement, fetching: unlinking } = useUnlinkCreditCardStatement();
  const { dismissCreditCardStatements, fetching: dismissing } = useDismissCreditCardStatements();
  const busy = linking || unlinking || dismissing;

  const { statements, suggestions } = useMemo(
    () =>
      charge.__typename === 'CreditcardBankCharge'
        ? {
            statements: charge.creditCardStatements ?? [],
            suggestions: charge.creditCardStatementSuggestions ?? [],
          }
        : { statements: [], suggestions: [] },
    [charge],
  );

  // one group per bank debit: the statements it settles (stored or matched) and the candidates
  // a person may link instead or in addition
  const groups = useMemo(() => {
    const byBank = new Map<string, BankDebitGroup>();
    const groupOf = (id: string, amount: BankAmount): BankDebitGroup => {
      const existing = byBank.get(id);
      if (existing) {
        return existing;
      }
      const group: BankDebitGroup = {
        bankTransactionId: id,
        amount,
        effectiveDate: null,
        description: null,
        statements: [],
        suggestions: [],
      };
      byBank.set(id, group);
      return group;
    };
    for (const statement of statements) {
      if (statement.bankTransaction) {
        groupOf(statement.bankTransaction.id, statement.bankTransaction.amount).statements.push(
          statement,
        );
      }
    }
    for (const { bankTransaction, suggestions: candidates } of suggestions) {
      const group = groupOf(bankTransaction.id, bankTransaction.amount);
      group.effectiveDate = bankTransaction.effectiveDate ?? null;
      group.description = bankTransaction.sourceDescription || null;
      group.suggestions = candidates;
    }
    return Array.from(byBank.values());
  }, [statements, suggestions]);

  const link = useCallback(
    async (bankTransactionId: string, toLink: (Statement | SuggestedStatement)[]) => {
      const result = await linkCreditCardStatements({
        bankTransactionId,
        statements: toLink.map(statementKey),
      });
      if (result) {
        onChange?.();
      }
    },
    [linkCreditCardStatements, onChange],
  );

  const dismiss = useCallback(
    async (bankTransactionId: string, toDismiss: Statement[]) => {
      const result = await dismissCreditCardStatements({
        bankTransactionId,
        statements: toDismiss.map(statementKey),
      });
      if (result) {
        onChange?.();
      }
    },
    [dismissCreditCardStatements, onChange],
  );

  const unlink = useCallback(
    async (bankTransactionId: string, statement: Statement) => {
      const result = await unlinkCreditCardStatement({
        bankTransactionId,
        statement: statementKey(statement),
      });
      if (result) {
        onChange?.();
      }
    },
    [unlinkCreditCardStatement, onChange],
  );

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No bank debit found on this charge.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(group => {
        const unconfirmed = group.statements.filter(statement => !statement.confirmed);
        const totalCents = group.statements.reduce((sum, s) => sum + toCents(s.total.raw), 0);
        return (
          <div key={group.bankTransactionId} className="flex flex-col gap-3 rounded-md border p-2">
            <div className="flex flex-row flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Bank debit {group.amount.formatted}</span>
              {group.effectiveDate && (
                <span className="text-muted-foreground">on {group.effectiveDate}</span>
              )}
              {group.description && (
                <span className="text-muted-foreground">({group.description})</span>
              )}
              {unconfirmed.length > 0 && (
                <div className="ml-auto flex flex-row gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void link(group.bankTransactionId, unconfirmed)}
                  >
                    <Check className="size-4" />
                    {unconfirmed.length > 1
                      ? `Confirm ${unconfirmed.length} statements`
                      : 'Confirm'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    title="Reject this match without linking: it will not be proposed again"
                    onClick={() => void dismiss(group.bankTransactionId, unconfirmed)}
                  >
                    <X className="size-4" />
                    Dismiss
                  </Button>
                </div>
              )}
            </div>

            {group.statements.length > 0 && totalCents !== toCents(group.amount.raw) && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Statement totals do not match the bank debit</AlertTitle>
                <AlertDescription>
                  Bank debit {group.amount.formatted}, statements total{' '}
                  {(totalCents / 100).toFixed(2)}. Card transactions may be missing, or a statement
                  is missing or wrong.
                </AlertDescription>
              </Alert>
            )}

            {group.statements.map(statement => (
              <div key={statement.id} className="flex flex-col gap-2 rounded-md border p-2">
                <div className="flex flex-row flex-wrap items-center gap-2">
                  <span className="font-medium">{cardLabel(statement.cardAccount)}</span>
                  <span className="text-sm text-muted-foreground">
                    Debit date {statement.debitDate}
                  </span>
                  <span className="text-sm">{statement.total.formatted}</span>
                  {statement.linkMethod && (
                    <Badge variant="secondary">{LINK_METHOD_LABELS[statement.linkMethod]}</Badge>
                  )}
                  {!statement.confirmed && <Badge variant="outline">Unconfirmed</Badge>}
                  {statement.confirmed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      disabled={busy}
                      onClick={() => void unlink(group.bankTransactionId, statement)}
                    >
                      <Unlink className="size-4" />
                      Unlink
                    </Button>
                  )}
                </div>
                <StatementTransactionsTable statement={statement} />
              </div>
            ))}

            {group.statements.length === 0 && (
              <p className="text-sm">
                <span className="font-medium">No statement linked</span> to this bank debit.
              </p>
            )}

            {group.suggestions.length > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{suggestionsTitle(group)}</span>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Statements</TableHead>
                      <TableHead>Why</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.suggestions.map(candidate => (
                      <TableRow key={candidate.statements.map(s => s.id).join(',')}>
                        <TableCell>
                          {candidate.statements.map(statement => (
                            <div key={statement.id}>
                              {[
                                cardLabel(statement.cardAccount),
                                statement.debitDate,
                                statement.total.formatted,
                              ].join(' · ')}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {candidate.previouslyRejected && (
                            <Badge variant="outline" className="mr-2">
                              Previously unlinked
                            </Badge>
                          )}
                          {candidate.reason}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void link(group.bankTransactionId, candidate.statements)}
                          >
                            <Link2 className="size-4" />
                            Link
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              group.statements.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No card statement found around this debit date.
                </p>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
