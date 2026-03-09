import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    allOpenContracts: [Contract!]! @requiresAuth
    contractsByClient(clientId: UUID!): [Contract!]! @requiresAuth
    contractsByAdmin(adminId: UUID!): [Contract!]! @requiresAuth
    contractsById(id: UUID!): Contract! @requiresAuth
  }

  extend type Mutation {
    updateContract(contractId: UUID!, input: UpdateContractInput!): Contract!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    deleteContract(id: UUID!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    createContract(input: CreateContractInput!): Contract!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
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
    operationsLimit: BigInt!
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
    operationsLimit: BigInt
    deactivateContracts: [UUID!]
  }

  " input for updating a contract "
  input UpdateContractInput {
    clientId: UUID
    purchaseOrders: [String!]
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
    operationsLimit: BigInt
  }
`;
