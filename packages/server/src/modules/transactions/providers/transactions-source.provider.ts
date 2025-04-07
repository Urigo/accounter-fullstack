import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type { IGetTransactionsSourceByIdsQuery } from '../__generated__/transactions-source.types.js';

const getTransactionsSourceByIds = sql<IGetTransactionsSourceByIdsQuery>`
    WITH original_transaction AS (SELECT isracard_creditcard_transactions.id::text                              AS raw_id,
                                     COALESCE(isracard_creditcard_transactions.voucher_number::text,
                                              isracard_creditcard_transactions.voucher_number_ratz::text)   AS reference_number,
                                     0                                                                      AS currency_rate,
                                     NULL::timestamp without time zone                                      AS debit_timestamp,
                                     'ISRACARD'::text                                                       AS origin,
                                     isracard_creditcard_transactions.card                                  AS card_number,
                                     COALESCE(isracard_creditcard_transactions.full_supplier_name_heb,
                                              isracard_creditcard_transactions.full_supplier_name_outbound) AS source_details,
                                     CASE
                                         WHEN isracard_creditcard_transactions.supplier_id IS NOT NULL AND
                                              isracard_creditcard_transactions.supplier_id <> 0
                                             THEN isracard_creditcard_transactions.supplier_id::text::character varying
                                         ELSE isracard_creditcard_transactions.full_supplier_name_outbound
                                         END                                                                AS counter_account
                              FROM accounter_schema.isracard_creditcard_transactions
                              UNION
                              SELECT amex_creditcard_transactions.id::text                              AS raw_id,
                                     COALESCE(amex_creditcard_transactions.voucher_number::text,
                                              amex_creditcard_transactions.voucher_number_ratz::text)   AS reference_number,
                                     0                                                                  AS currency_rate,
                                     NULL::timestamp without time zone                                  AS debit_timestamp,
                                     'AMEX'::text                                                       AS origin,
                                     amex_creditcard_transactions.card                                  AS card_number,
                                     COALESCE(amex_creditcard_transactions.full_supplier_name_heb,
                                              amex_creditcard_transactions.full_supplier_name_outbound) AS source_details,
                                     CASE
                                         WHEN amex_creditcard_transactions.supplier_id IS NOT NULL AND
                                              amex_creditcard_transactions.supplier_id <> 0
                                             THEN amex_creditcard_transactions.supplier_id::text::character varying
                                         ELSE amex_creditcard_transactions.full_supplier_name_outbound
                                         END                                                            AS counter_account
                              FROM accounter_schema.amex_creditcard_transactions
                              UNION
                              SELECT max_creditcard_transactions.id::text                   AS raw_id,
                                     max_creditcard_transactions.arn                        AS reference_number,
                                     max_creditcard_transactions.deal_data_exchange_rate    AS currency_rate,
                                     max_creditcard_transactions.payment_date +
                                     max_creditcard_transactions.deal_data_purchase_time    AS debit_timestamp,
                                     'MAX'::text                                            AS origin,
                                     max_creditcard_transactions.short_card_number::integer AS card_number,
                                     concat_ws(' | '::text, max_creditcard_transactions.merchant_name,
                                               max_creditcard_transactions.merchant_commercial_name,
                                               max_creditcard_transactions.comments)        AS source_details,
                                     CASE
                                         WHEN max_creditcard_transactions.merchant_tax_id IS NOT NULL AND
                                              max_creditcard_transactions.merchant_tax_id::text <> ''::text
                                             THEN max_creditcard_transactions.merchant_tax_id::text
                                         ELSE max_creditcard_transactions.merchant_name
                                         END                                                AS counter_account
                              FROM accounter_schema.max_creditcard_transactions
                              UNION
                              SELECT poalim_ils_account_transactions.id::text                                AS id,
                                     poalim_ils_account_transactions.reference_number::text                  AS reference_number,
                                     0                                                                       AS currency_rate,
                                     NULL::timestamp without time zone                                       AS debit_timestamp,
                                     'POALIM'::text                                                          AS origin,
                                     NULL::integer                                                           AS card_number,
                                     poalim_ils_account_transactions.beneficiary_details_data_message_detail AS source_details,
                                     CASE
                                         WHEN poalim_ils_account_transactions.contra_account_number <> 0 THEN concat(
                                                 poalim_ils_account_transactions.contra_bank_number, '-',
                                                 poalim_ils_account_transactions.contra_branch_number, '-',
                                                 poalim_ils_account_transactions.contra_account_number)
                                         ELSE NULL::text
                                         END                                                                 AS counter_account
                              FROM accounter_schema.poalim_ils_account_transactions
                              UNION
                              SELECT poalim_eur_account_transactions.id::text               AS id,
                                     poalim_eur_account_transactions.reference_number::text AS reference_number,
                                     poalim_eur_account_transactions.currency_rate,
                                     NULL::timestamp without time zone                      AS debit_timestamp,
                                     'POALIM'::text                                         AS origin,
                                     NULL::integer                                          AS card_number,
                                     poalim_eur_account_transactions.event_details          AS source_details,
                                     CASE
                                         WHEN poalim_eur_account_transactions.contra_account_number <> 0 THEN concat(
                                                 poalim_eur_account_transactions.contra_bank_number, '-',
                                                 poalim_eur_account_transactions.contra_branch_number, '-',
                                                 poalim_eur_account_transactions.contra_account_number)
                                         ELSE NULL::text
                                         END                                                AS counter_account
                              FROM accounter_schema.poalim_eur_account_transactions
                              UNION
                              SELECT poalim_gbp_account_transactions.id::text               AS id,
                                     poalim_gbp_account_transactions.reference_number::text AS reference_number,
                                     poalim_gbp_account_transactions.currency_rate,
                                     NULL::timestamp without time zone                      AS debit_timestamp,
                                     'POALIM'::text                                         AS origin,
                                     NULL::integer                                          AS card_number,
                                     poalim_gbp_account_transactions.event_details          AS source_details,
                                     CASE
                                         WHEN poalim_gbp_account_transactions.contra_account_number <> 0 THEN concat(
                                                 poalim_gbp_account_transactions.contra_bank_number, '-',
                                                 poalim_gbp_account_transactions.contra_branch_number, '-',
                                                 poalim_gbp_account_transactions.contra_account_number)
                                         ELSE NULL::text
                                         END                                                AS counter_account
                              FROM accounter_schema.poalim_gbp_account_transactions
                              UNION
                              SELECT poalim_cad_account_transactions.id::text               AS id,
                                     poalim_cad_account_transactions.reference_number::text AS reference_number,
                                     poalim_cad_account_transactions.currency_rate,
                                     NULL::timestamp without time zone                      AS debit_timestamp,
                                     'POALIM'::text                                         AS origin,
                                     NULL::integer                                          AS card_number,
                                     poalim_cad_account_transactions.event_details          AS source_details,
                                     CASE
                                         WHEN poalim_cad_account_transactions.contra_account_number <> 0 THEN concat(
                                                 poalim_cad_account_transactions.contra_bank_number, '-',
                                                 poalim_cad_account_transactions.contra_branch_number, '-',
                                                 poalim_cad_account_transactions.contra_account_number)
                                         ELSE NULL::text
                                         END                                                AS counter_account
                              FROM accounter_schema.poalim_cad_account_transactions
                              UNION
                              SELECT poalim_usd_account_transactions.id::text               AS id,
                                     poalim_usd_account_transactions.reference_number::text AS reference_number,
                                     poalim_usd_account_transactions.currency_rate,
                                     NULL::timestamp without time zone                      AS debit_timestamp,
                                     'POALIM'::text                                         AS origin,
                                     NULL::integer                                          AS card_number,
                                     poalim_usd_account_transactions.event_details          AS source_details,
                                     CASE
                                         WHEN poalim_usd_account_transactions.contra_account_number <> 0 THEN concat(
                                                 poalim_usd_account_transactions.contra_bank_number, '-',
                                                 poalim_usd_account_transactions.contra_branch_number, '-',
                                                 poalim_usd_account_transactions.contra_account_number)
                                         ELSE NULL::text
                                         END                                                AS counter_account
                              FROM accounter_schema.poalim_usd_account_transactions
                              UNION
                              SELECT poalim_swift_account_transactions.id::text          AS id,
                                     poalim_swift_account_transactions.reference_number,
                                     0,
                                     NULL::timestamp without time zone                   AS debit_timestamp,
                                     'POALIM'::text                                      AS origin,
                                     NULL::integer                                       AS card_number,
                                     poalim_swift_account_transactions.charge_party_name AS source_details,
                                     'SWIFT'::character varying                          AS counter_account
                              FROM accounter_schema.poalim_swift_account_transactions
                              UNION
                              SELECT poalim_deposits_account_transactions_manual.id::text AS id,
                                     poalim_deposits_account_transactions_manual.deposit_key,
                                     0,
                                     NULL::timestamp without time zone                    AS debit_timestamp,
                                     'POALIM'::text                                       AS origin,
                                     NULL::integer                                        AS card_number,
                                     'bank deposit'::character varying                    AS source_details,
                                     NULL::character varying                              AS counter_account
                              FROM accounter_schema.poalim_deposits_account_transactions_manual
                              UNION
                              SELECT kraken_ledger_records.ledger_id,
                                     kraken_ledger_records.ledger_id,
                                     CASE
                                         WHEN kraken_trades.price IS NOT NULL THEN 1::numeric / kraken_trades.price
                                         ELSE 0::numeric
                                         END                                   AS currency_rate,
                                     kraken_ledger_records.value_date          AS debit_timestamp,
                                     'KRAKEN'::text                            AS origin,
                                     NULL::integer                             AS card_number,
                                     concat(kraken_ledger_records.account_nickname, '_',
                                            kraken_ledger_records.action_type) AS source_details,
                                     CASE
                                         WHEN kraken_ledger_records.action_type = 'trade'::text THEN 'KRAKEN'::text
                                         ELSE NULL::text
                                         END                                   AS counter_account
                              FROM accounter_schema.kraken_ledger_records
                                       LEFT JOIN accounter_schema.kraken_trades
                                                 ON kraken_ledger_records.trade_ref_id = kraken_trades.trade_id
                              UNION
                              SELECT etana_account_transactions.transaction_id,
                                     etana_account_transactions.transaction_id,
                                     0,
                                     NULL::timestamp without time zone      AS debit_timestamp,
                                     'ETANA'::text                          AS origin,
                                     NULL::integer                          AS card_number,
                                     etana_account_transactions.description AS source_details,
                                     CASE
                                         WHEN etana_account_transactions.action_type = 'fee'::text THEN 'ETANA'::text
                                         ELSE NULL::text
                                         END                                AS counter_account
                              FROM accounter_schema.etana_account_transactions
                              UNION
                              SELECT etherscan_transactions.id::text           AS id,
                                     etherscan_transactions.transaction_hash,
                                     0,
                                     etherscan_transactions.event_date         AS debit_timestamp,
                                     'ETHERSCAN'::text                         AS origin,
                                     NULL::integer                             AS card_number,
                                     concat(etherscan_transactions.from_address, ' TO ',
                                            etherscan_transactions.to_address) AS source_details,
                                     CASE
                                         WHEN etherscan_transactions.wallet_address =
                                              etherscan_transactions.from_address THEN etherscan_transactions.to_address
                                         ELSE etherscan_transactions.from_address
                                         END                                   AS counter_account
                              FROM accounter_schema.etherscan_transactions
                              UNION
                              SELECT cal_creditcard_transactions.id::text                AS id,
                                     cal_creditcard_transactions.trn_int_id              AS reference_number,
                                     0                                                   AS currency_rate,
                                     NULL::timestamp without time zone                   AS debit_timestamp,
                                     'CAL'::text                                         AS origin,
                                     cal_creditcard_transactions.card                    AS card_number,
                                     cal_creditcard_transactions.merchant_name           AS source_details,
                                     COALESCE(cal_creditcard_transactions.merchant_id,
                                              cal_creditcard_transactions.merchant_name) AS counter_account
                              FROM accounter_schema.cal_creditcard_transactions
                              UNION
                              SELECT bank_discount_transactions.id::text              AS id,
                                     bank_discount_transactions.urn                   AS reference_number,
                                     0                                                AS currency_rate,
                                     NULL::timestamp without time zone                AS debit_timestamp,
                                     'BANK_DISCOUNT'::text                            AS origin,
                                     NULL::integer                                    AS card_number,
                                     bank_discount_transactions.operation_description AS source_details,
                                     CASE
                                         WHEN bank_discount_transactions.operation_number IS NOT NULL AND
                                              bank_discount_transactions.operation_number <> 0 THEN concat(
                                                 bank_discount_transactions.operation_bank, '-',
                                                 bank_discount_transactions.operation_branch, '-',
                                                 bank_discount_transactions.operation_number)
                                         ELSE NULL::text
                                         END                                          AS counter_account
                              FROM accounter_schema.bank_discount_transactions)
SELECT t.id,
       original_transaction.debit_timestamp,
       original_transaction.source_details,
       original_transaction.raw_id           AS source_id,
       original_transaction.reference_number AS source_reference,
       original_transaction.origin           AS source_origin,
       original_transaction.currency_rate,
       CASE
           WHEN f.id IS NULL THEN false
           ELSE true
           END                               AS is_fee,
       concat(original_transaction.counter_account,
              CASE
                  WHEN f.id IS NULL OR original_transaction.counter_account IS NULL OR
                       original_transaction.counter_account::text = ''::text THEN ''::text
                  ELSE '_fee'::text
                  END)::character varying    AS counter_account
FROM accounter_schema.transactions t
         LEFT JOIN accounter_schema.transactions_raw_list rt ON t.source_id = rt.id
         LEFT JOIN accounter_schema.transactions_fees f ON f.id = t.id
         LEFT JOIN original_transaction ON original_transaction.raw_id =
                                           COALESCE(rt.creditcard_id::text, rt.poalim_ils_id::text,
                                                    rt.poalim_eur_id::text, rt.poalim_gbp_id::text,
                                                    rt.poalim_swift_id::text, rt.poalim_usd_id::text, rt.kraken_id,
                                                    rt.etana_id, rt.etherscan_id::text, rt.amex_id::text,
                                                    rt.cal_id::text, rt.bank_discount_id::text, rt.poalim_cad_id::text,
                                                    rt.max_creditcard_id::text)

WHERE t.id IN $$transactionIds;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TransactionsSourceProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchTransactionsSourceByIds(ids: readonly string[]) {
    const sourcesInfo = await getTransactionsSourceByIds.run(
      {
        transactionIds: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => {
      const sourceInfo = sourcesInfo.find(sourceInfo => sourceInfo.id === id);
      if (!sourceInfo) {
        return new Error(`Transaction ID="${id}" source info not found`);
      }
      return sourceInfo;
    });
  }

  public transactionSourceByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchTransactionsSourceByIds(ids),
    {
      cacheKeyFn: id => `transaction-${id}-source`,
      cacheMap: this.cache,
    },
  );

  public clearCache() {
    this.cache.clear();
  }
}
