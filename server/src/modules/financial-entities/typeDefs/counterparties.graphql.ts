import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  " The other side of a transaction "
  interface Counterparty {
    name: String!
    id: UUID!
  }

  " input variables for updateCharge.Counterparty"
  input CounterpartyInput {
    id: UUID!
  }

  " defines a link between a counterparty and their part in the charge "
  type BeneficiaryCounterparty {
    counterparty: Counterparty!
    percentage: Percentage!
  }

  " represent a counterparty with a name "
  type NamedCounterparty implements Counterparty {
    name: String!
    id: UUID!
  }

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
