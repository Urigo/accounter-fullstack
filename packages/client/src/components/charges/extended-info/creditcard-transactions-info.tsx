import { useCallback, useMemo, type ReactElement } from 'react';
import { AlertTriangle, Check, Link2, Unlink } from 'lucide-react';
import {
  CreditcardBankChargeInfoFragmentDoc,
  CreditCardStatementLinkMethod,
  TransactionForTransactionsTableFieldsFragmentDoc,
  type CreditcardBankChargeInfoFragment,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
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
  const busy = linking || unlinking;

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

  // statements grouped by the bank debit settling them, to compare their totals with the debit
  const byBankTransaction = useMemo(() => {
    const groups = new Map<string, { bankAmount: Statement['total']; statements: Statement[] }>();
    for (const statement of statements) {
      const bank = statement.bankTransaction;
      if (!bank) {
        continue;
      }
      const group = groups.get(bank.id) ?? { bankAmount: bank.amount, statements: [] };
      group.statements.push(statement);
      groups.set(bank.id, group);
    }
    return Array.from(groups.entries()).map(([bankTransactionId, group]) => ({
      bankTransactionId,
      ...group,
      totalCents: group.statements.reduce((sum, s) => sum + toCents(s.total.raw), 0),
    }));
  }, [statements]);

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

  if (statements.length === 0 && suggestions.length === 0) {
    return <p className="text-sm text-muted-foreground">No bank debit found on this charge.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {byBankTransaction.map(group => (
        <div key={group.bankTransactionId} className="flex flex-col gap-3">
          {group.totalCents !== toCents(group.bankAmount.raw) && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Statement totals do not match the bank debit</AlertTitle>
              <AlertDescription>
                Bank debit {group.bankAmount.formatted}, statements total{' '}
                {(group.totalCents / 100).toFixed(2)}. Card transactions may be missing, or the
                wrong statement is linked.
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
                <div className="ml-auto flex flex-row gap-2">
                  {statement.confirmed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void unlink(group.bankTransactionId, statement)}
                    >
                      <Unlink className="size-4" />
                      Unlink
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void link(group.bankTransactionId, [statement])}
                    >
                      <Check className="size-4" />
                      Confirm
                    </Button>
                  )}
                </div>
              </div>
              <StatementTransactionsTable statement={statement} />
            </div>
          ))}
        </div>
      ))}

      {suggestions.map(({ bankTransaction, suggestions: candidates }) => (
        <div key={bankTransaction.id} className="flex flex-col gap-2 rounded-md border p-2">
          <div className="text-sm">
            <span className="font-medium">No statement linked</span> to the bank debit of{' '}
            {bankTransaction.amount.formatted}
            {bankTransaction.effectiveDate ? ` on ${bankTransaction.effectiveDate}` : ''}
            {bankTransaction.sourceDescription ? ` (${bankTransaction.sourceDescription})` : ''}
          </div>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No card statement found around this debit date.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Statements</TableHead>
                  <TableHead>Why</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map(candidate => (
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
                      {candidate.reason}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void link(bankTransaction.id, candidate.statements)}
                      >
                        <Link2 className="size-4" />
                        Link
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ))}
    </div>
  );
}
