import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    allOpenContracts: [Contract!]! @auth(role: ACCOUNTANT)
    contractsByClient(clientId: UUID!): [Contract!]! @auth(role: ACCOUNTANT)
    contractsByAdmin(adminId: UUID!): [Contract!]! @auth(role: ACCOUNTANT)
    contractsById(id: UUID!): Contract! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateContract(contractId: UUID!, input: UpdateContractInput!): Contract!
      @auth(role: ACCOUNTANT)
    deleteContract(id: UUID!): Boolean! @auth(role: ACCOUNTANT)
    createContract(input: CreateContractInput!): Contract! @auth(role: ACCOUNTANT)
  }

  " a client contract "
  type Contract {
    id: UUID!
    client: Client!
    purchaseOrders: [String!]!
    startDate: TimelessDate!
    endDate: TimelessDate!
    remarks: String
    amount: FinancialAmount!
    documentType: DocumentType!
    billingCycle: BillingCycle!
    isActive: Boolean!
    product: Product
    plan: SubscriptionPlan
    msCloud: URL
    operationsLimit: Int!
  }

  " contract billing cycle "
  enum BillingCycle {
    MONTHLY
    ANNUAL
  }

  " contract products "
  enum Product {
    HIVE
    STELLATE
  }

  " contract subscription plans "
  enum SubscriptionPlan {
    ENTERPRISE
    PRO
  }

  " input for creating a new contract "
  input CreateContractInput {
    clientId: UUID!
    purchaseOrders: [String!]!
    startDate: TimelessDate!
    endDate: TimelessDate!
    remarks: String
    amount: FinancialAmountInput!
    documentType: DocumentType!
    billingCycle: BillingCycle!
    product: Product
    plan: SubscriptionPlan
    msCloud: URL
    isActive: Boolean!
    operationsLimit: Int
  }

  " input for updating a contract "
  input UpdateContractInput {
    clientId: UUID
    purchaseOrders: [String!]!
    startDate: TimelessDate
    endDate: TimelessDate
    remarks: String
    amount: FinancialAmountInput
    documentType: DocumentType
    billingCycle: BillingCycle
    product: Product
    plan: SubscriptionPlan
    msCloud: URL
    isActive: Boolean
    operationsLimit: Int
  }
`;
