import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    allOpenContracts: [Contract!]! @auth(role: ACCOUNTANT)
    contractsByClient(clientId: UUID!): [Contract!]! @auth(role: ACCOUNTANT)
  }

  " a client contract "
  type Contract {
    id: UUID!
    client: Client!
    purchaseOrder: String
    startDate: TimelessDate!
    endDate: TimelessDate!
    remarks: String
    amount: FinancialAmount!
    documentType: DocumentType!
    billingCycle: BillingCycle!
    isActive: Boolean!
    product: Product
    plan: SubscriptionPlan
    signedAgreement: URL
    msCloud: URL
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
`;
