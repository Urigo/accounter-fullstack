import type { Injector } from 'graphql-modules';
import {
  CreditCardStatementsProvider,
  type BankTransactionRow,
} from '../providers/creditcard-statements.provider.js';
import {
  buildMatcherInput,
  type ResolvedCreditCardStatement,
} from '../providers/creditcard-transactions.provider.js';
import {
  isConfidentMatch,
  matchCreditCardStatements,
  statementKeyId,
  type AutoLinkMethod,
  type StatementKey,
} from './creditcard-statement-matcher.helper.js';

const DEFAULT_BATCH_SIZE = 100;

export type AutoLinkedStatements = {
  bankTransactionId: string;
  /** The charge holding the bank transaction */
  chargeId: string;
  method: AutoLinkMethod;
  statements: ResolvedCreditCardStatement[];
  /** What `assessLink` returned for this debit, before its links were written */
  changesAccounting: boolean;
};

/**
 * Called for each debit about to be linked, before anything is written: whether the links change
 * how its charge is booked.
 */
export type AutoLinkAssessment = (
  bankRow: BankTransactionRow,
  links: readonly StatementKey[],
) => Promise<boolean>;

export type AutoLinkOutcome = {
  linkedCount: number;
  errors: string[];
};

/**
 * Links the owner's unlinked bank card debits to the card statements they settle, persisting only
 * confident matches (REFERENCE / AMOUNT). Ambiguous debits are left for a person to link from the
 * charge. Also serves as the history backfill: it scans every unlinked candidate of the owner.
 *
 * Candidates are bank transactions counted against a card issuer business, or carrying a strong
 * card hint. They are matched in batches; a statement claimed earlier in the run is not offered to
 * a later debit. Each debit's links are written atomically, so a debit settling several statements
 * never ends up half linked. Yields every debit it links.
 */
export async function* autoLinkCreditCardStatements(
  injector: Injector,
  params: {
    ownerId: string;
    creditCardBusinessIds: readonly string[];
    batchSize?: number;
    assessLink?: AutoLinkAssessment;
  },
): AsyncGenerator<AutoLinkedStatements, AutoLinkOutcome, undefined> {
  const provider = injector.get(CreditCardStatementsProvider);
  const { ownerId, creditCardBusinessIds, batchSize = DEFAULT_BATCH_SIZE, assessLink } = params;

  const candidateIds = await provider.getAutoLinkCandidateBankTransactionIds({
    ownerId,
    creditCardBusinessIds,
  });

  // statement → bank transaction that claimed it during this run
  const claimed = new Map<string, string>();
  const errors: string[] = [];
  let linkedCount = 0;

  for (let start = 0; start < candidateIds.length; start += batchSize) {
    const batchIds = candidateIds.slice(start, start + batchSize);
    // loaded up front for the whole batch: the writes below clear the providers' caches
    const [bankRows, hints, candidates, rejections] = await Promise.all([
      provider.getBankTransactionByIdLoader.loadMany(batchIds),
      provider.getBankCardHintsByTransactionIdLoader.loadMany(batchIds),
      provider.getCandidateStatementsByBankTransactionIdLoader.loadMany(batchIds),
      provider.getRejectedStatementsByBankTransactionIdLoader.loadMany(batchIds),
    ]);

    for (let i = 0; i < batchIds.length; i++) {
      const bankRow = bankRows[i];
      const rowHints = hints[i];
      const rowCandidates = candidates[i];
      const rowRejections = rejections[i];
      if (
        !bankRow ||
        bankRow instanceof Error ||
        rowHints instanceof Error ||
        rowCandidates instanceof Error ||
        rowRejections instanceof Error ||
        !bankRow.effective_date
      ) {
        continue;
      }

      const input = buildMatcherInput(bankRow, {
        hints: rowHints,
        candidates: rowCandidates,
        rejectedKeys: rowRejections,
        counterpartyIsCardIssuer: await provider.isCounterpartyCardIssuer(bankRow),
      });
      const statements = input.candidates.map(statement => ({
        ...statement,
        linkedBankTransactionId:
          statement.linkedBankTransactionId ?? claimed.get(statementKeyId(statement)) ?? null,
      }));

      const result = matchCreditCardStatements(input.bank, input.hints, statements, {
        rejectedKeys: input.rejectedKeys,
      });
      if (!isConfidentMatch(result)) {
        continue;
      }

      let changesAccounting = false;
      if (assessLink) {
        try {
          changesAccounting = await assessLink(bankRow, result.links);
        } catch (error) {
          errors.push(
            `Failed to assess the links of bank transaction ID=${bankRow.id}, so it was not linked: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
          continue;
        }
      }

      const linked = await persistLinks(provider, ownerId, bankRow, result.links, result.method);
      if (linked instanceof Error) {
        errors.push(linked.message);
        continue;
      }
      linked.changesAccounting = changesAccounting;
      for (const statement of linked.statements) {
        claimed.set(statementKeyId(statement), bankRow.id);
      }
      linkedCount++;
      yield linked;
    }
  }

  return { linkedCount, errors };
}

async function persistLinks(
  provider: CreditCardStatementsProvider,
  ownerId: string,
  bankRow: BankTransactionRow,
  links: readonly StatementKey[],
  method: AutoLinkMethod,
): Promise<AutoLinkedStatements | Error> {
  try {
    await provider.insertLinks(
      links.map(link => ({
        cardAccountId: link.cardAccountId,
        currency: link.currency,
        debitDate: link.debitDate,
        ownerId,
        bankTransactionId: bankRow.id,
        linkMethod: method,
      })),
    );
  } catch (error) {
    return new Error(
      `Failed to link bank transaction ID=${bankRow.id}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
  return {
    bankTransactionId: bankRow.id,
    chargeId: bankRow.charge_id,
    method,
    changesAccounting: false,
    statements: links.map(link => ({
      cardAccountId: link.cardAccountId,
      currency: link.currency,
      debitDate: link.debitDate,
      bankTransactionId: bankRow.id,
      linkMethod: method,
      confirmed: true,
    })),
  };
}
