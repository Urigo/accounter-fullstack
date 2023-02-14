import { gql } from 'graphql-modules';

export default gql`
  extend type Charge {
    " calculated counterparty details for the charge "
    counterparty: Counterparty
  }

  extend input UpdateChargeInput {
    counterparty: CounterpartyInput
  }

  extend type LedgerRecord {
    creditAccount: Counterparty
    debitAccount: Counterparty
  }

  extend input UpdateLedgerRecordInput {
    creditAccount: CounterpartyInput
    debitAccount: CounterpartyInput
  }

  extend input InsertLedgerRecordInput {
    creditAccount: CounterpartyInput
    debitAccount: CounterpartyInput
  }
`;
