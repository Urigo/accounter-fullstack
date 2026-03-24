import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    priorityInvoices(filter: PriorityInvoiceFilter): [PriorityInvoice!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type Mutation {
    testPriorityConnection: PriorityConnectionResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])

    syncPriorityInvoices(input: SyncPriorityInvoicesInput): SyncPriorityResult!
      @requiresAuth
      @requiresRole(role: "business_owner")

    importPriorityCSV(csvContent: String!): ImportPriorityCSVResult!
      @requiresAuth
      @requiresRole(role: "business_owner")
  }

  type PriorityConnectionResult {
    ok: Boolean!
    message: String!
  }

  type SyncPriorityResult {
    synced: Int!
    skipped: Int!
    errors: Int!
    message: String
  }

  type ImportPriorityCSVResult {
    imported: Int!
    skipped: Int!
    errors: Int!
    suppliersCreated: Int!
    taxCategoriesCreated: Int!
  }

  input PriorityInvoiceFilter {
    custname: String
    currency: String
    ivtype: String
  }

  input SyncPriorityInvoicesInput {
    fromDate: String
    pageSize: Int
  }

  type PriorityInvoice {
    id: ID!
    ownerId: UUID!
    ivnum: String!
    ivtype: String
    custname: String
    custVatid: String
    curdate: DateTime
    duedate: DateTime
    details: String
    currency: String
    netAmount: Float
    vat: Float
    total: Float
    discount: Float
    paid: Float
    balance: Float
    statdes: String
    syncedAt: DateTime!
    createdAt: DateTime!
    updatedAt: DateTime!
  }
`;
