import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAdminContextFromDb } from '../../../__tests__/helpers/admin-context-builder.js';
import { TestDatabase } from '../../../__tests__/helpers/db-setup.js';
import { qualifyTable } from '../../../__tests__/helpers/test-db-config.js';
import { env } from '../../../environment.js';
import { createLedgerTestContext } from '../../../test-utils/ledger-injector.js';
import { ledgerGenerationByCharge } from '../helpers/ledger-by-charge-type.helper.js';

/**
 * A bank's combined card debit, linked to two card statements, booked against the real database:
 * one ledger entry per statement, each for that statement's card total, against that card's tax
 * category. All values are fake.
 */
describe('Ledger generation - bank debit linked to card statements', () => {
  let db: TestDatabase;
  let ownerId: string;

  const ids = {
    issuer: randomUUID(),
    bankAccount: randomUUID(),
    cardA: randomUUID(),
    cardB: randomUUID(),
    bankTaxCategory: randomUUID(),
    cardATaxCategory: randomUUID(),
    cardBTaxCategory: randomUUID(),
    bankCharge: randomUUID(),
    cardCharge: randomUUID(),
    bankDebit: randomUUID(),
  };
  const rawListIds: string[] = [];

  async function query(text: string, params: unknown[] = []) {
    return db.getPool().query(text, params);
  }

  async function insertTransaction(seed: {
    id?: string;
    accountId: string;
    chargeId: string;
    amount: string;
    eventDate: string;
    debitDate: string;
    businessId?: string | null;
  }) {
    const rawListId = randomUUID();
    rawListIds.push(rawListId);
    await query(`INSERT INTO ${qualifyTable('transactions_raw_list')} (id, etana_id) VALUES ($1, $2)`, [
      rawListId,
      `card-links-ledger-test-${rawListId}`,
    ]);
    const id = seed.id ?? randomUUID();
    await query(
      `INSERT INTO ${qualifyTable('transactions')} (
         id, account_id, charge_id, source_id, source_description, currency, event_date,
         debit_date, amount, current_balance, business_id, source_reference, source_origin,
         origin_key, owner_id
       )
       VALUES ($1, $2, $3, $4, 'CARD DEBIT', 'ILS', $5, $6, $7, 0, $8, 'card-links-test',
         'TEST', $9, $10)`,
      [
        id,
        seed.accountId,
        seed.chargeId,
        rawListId,
        seed.eventDate,
        seed.debitDate,
        seed.amount,
        seed.businessId ?? null,
        `card-links-ledger-test-${id}`,
        ownerId,
      ],
    );
    return id;
  }

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
    await db.ensureLatestSchema();
    await db.seedAdmin();
    const client = await db.getPool().connect();
    try {
      ownerId = (await buildAdminContextFromDb(client)).ownerId;
    } finally {
      client.release();
    }

    // a card issuer business that is not in the admin context: the link alone makes the charge
    // a card debit
    await query(
      `INSERT INTO ${qualifyTable('financial_entities')} (id, name, type, owner_id)
       VALUES ($1, 'Card links test issuer', 'business', $2)`,
      [ids.issuer, ownerId],
    );
    await query(`INSERT INTO ${qualifyTable('businesses')} (id, owner_id) VALUES ($1, $2)`, [
      ids.issuer,
      ownerId,
    ]);
    for (const [taxCategoryId, name] of [
      [ids.bankTaxCategory, 'Card links test bank'],
      [ids.cardATaxCategory, 'Card links test card A'],
      [ids.cardBTaxCategory, 'Card links test card B'],
    ]) {
      await query(
        `INSERT INTO ${qualifyTable('financial_entities')} (id, name, type, owner_id)
         VALUES ($1, $2, 'tax_category', $3)`,
        [taxCategoryId, name, ownerId],
      );
      await query(`INSERT INTO ${qualifyTable('tax_categories')} (id, owner_id) VALUES ($1, $2)`, [
        taxCategoryId,
        ownerId,
      ]);
    }
    for (const [accountId, accountNumber, type, taxCategoryId] of [
      [ids.bankAccount, 'CARD-LINKS-BANK', 'BANK_ACCOUNT', ids.bankTaxCategory],
      [ids.cardA, '9101', 'CREDIT_CARD', ids.cardATaxCategory],
      [ids.cardB, '9102', 'CREDIT_CARD', ids.cardBTaxCategory],
    ]) {
      await query(
        `INSERT INTO ${qualifyTable('financial_accounts')}
           (id, account_number, private_business, owner, type, owner_id)
         VALUES ($1, $2, 'BUSINESS', $3, $4, $3)`,
        [accountId, accountNumber, ownerId, type],
      );
      await query(
        `INSERT INTO ${qualifyTable('financial_accounts_tax_categories')}
           (financial_account_id, currency, tax_category_id, owner_id)
         VALUES ($1, 'ILS', $2, $3)`,
        [accountId, taxCategoryId, ownerId],
      );
    }
    for (const chargeId of [ids.bankCharge, ids.cardCharge]) {
      await query(`INSERT INTO ${qualifyTable('charges')} (id, owner_id) VALUES ($1, $2)`, [
        chargeId,
        ownerId,
      ]);
    }

    await insertTransaction({
      id: ids.bankDebit,
      accountId: ids.bankAccount,
      chargeId: ids.bankCharge,
      amount: '-450.25',
      eventDate: '2026-04-10',
      debitDate: '2026-04-10',
      businessId: ids.issuer,
    });
    // card A's statement: 300.20 in two rows; card B's: 150.05
    for (const [accountId, amount, debitDate] of [
      [ids.cardA, '-200.10', '2026-04-10'],
      [ids.cardA, '-100.10', '2026-04-10'],
      [ids.cardB, '-150.05', '2026-04-09'],
    ]) {
      await insertTransaction({
        accountId,
        chargeId: ids.cardCharge,
        amount,
        eventDate: '2026-03-20',
        debitDate,
      });
    }
    for (const [cardAccountId, debitDate] of [
      [ids.cardA, '2026-04-10'],
      [ids.cardB, '2026-04-09'],
    ]) {
      await query(
        `INSERT INTO ${qualifyTable('creditcard_statement_links')}
           (owner_id, bank_transaction_id, card_account_id, currency, debit_date, link_method)
         VALUES ($1, $2, $3, 'ILS', $4, 'MANUAL')`,
        [ownerId, ids.bankDebit, cardAccountId, debitDate],
      );
    }
  });

  afterAll(async () => {
    if (!ownerId) {
      return;
    }
    // links cascade with the bank transaction
    await query(`DELETE FROM ${qualifyTable('transactions')} WHERE charge_id = ANY($1)`, [
      [ids.bankCharge, ids.cardCharge],
    ]);
    await query(`DELETE FROM ${qualifyTable('transactions_raw_list')} WHERE id = ANY($1)`, [
      rawListIds,
    ]);
    await query(`DELETE FROM ${qualifyTable('charges')} WHERE id = ANY($1)`, [
      [ids.bankCharge, ids.cardCharge],
    ]);
    await query(
      `DELETE FROM ${qualifyTable('financial_accounts_tax_categories')}
       WHERE financial_account_id = ANY($1)`,
      [[ids.bankAccount, ids.cardA, ids.cardB]],
    );
    await query(`DELETE FROM ${qualifyTable('financial_accounts')} WHERE id = ANY($1)`, [
      [ids.bankAccount, ids.cardA, ids.cardB],
    ]);
    const entityIds = [
      ids.bankTaxCategory,
      ids.cardATaxCategory,
      ids.cardBTaxCategory,
      ids.issuer,
    ];
    await query(`DELETE FROM ${qualifyTable('tax_categories')} WHERE id = ANY($1)`, [entityIds]);
    await query(`DELETE FROM ${qualifyTable('businesses')} WHERE id = ANY($1)`, [entityIds]);
    await query(`DELETE FROM ${qualifyTable('financial_entities')} WHERE id = ANY($1)`, [
      entityIds,
    ]);
    // Do NOT close the shared pool here — it is shared with other concurrently-running suites.
  });

  it('books one entry per linked statement, for its card total, against its card', async () => {
    const { rows } = await query(`SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`, [
      ids.bankCharge,
    ]);
    const context = createLedgerTestContext({
      pool: db.getPool(),
      env,
      moduleId: 'ledger',
      businessId: ownerId,
    });

    const result = await ledgerGenerationByCharge(
      rows[0],
      { insertLedgerRecordsIfNotExists: false },
      context as never,
      {} as never,
    );
    if (!result || 'message' in result) {
      throw new Error(`Ledger generation failed: ${result ? result.message : 'null result'}`);
    }

    expect(result.errors).toEqual([]);
    expect(result.balance?.isBalanced).toBe(true);
    const entries = result.records
      .map(record => ({
        debit: record.debit_entity1,
        credit: record.credit_entity1,
        amount: Number(record.debit_local_amount1),
        valueDate: record.value_date,
      }))
      .sort((a, b) => b.amount - a.amount);
    expect(entries).toEqual([
      {
        debit: ids.cardATaxCategory,
        credit: ids.bankTaxCategory,
        amount: 300.2,
        valueDate: '2026-04-10',
      },
      {
        debit: ids.cardBTaxCategory,
        credit: ids.bankTaxCategory,
        amount: 150.05,
        valueDate: '2026-04-10',
      },
    ]);
  });
});
