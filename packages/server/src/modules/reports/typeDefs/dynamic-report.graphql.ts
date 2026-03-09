import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    dynamicReport(name: String!): DynamicReportInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    allDynamicReports: [DynamicReportInfo!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type Mutation {
    updateDynamicReportTemplate(name: String!, template: String!): DynamicReportInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateDynamicReportTemplateName(name: String!, newName: String!): DynamicReportInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    insertDynamicReportTemplate(name: String!, template: String!): DynamicReportInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    deleteDynamicReportTemplate(name: String!): String!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " dynamic report data "
  type DynamicReportInfo {
    id: ID!
    name: String!
    template: [DynamicReportNode!]!
    created: DateTime!
    updated: DateTime!
  }

  " a single node of dynamic report template "
  type DynamicReportNode {
    id: ID!
    parent: String!
    text: String!
    droppable: Boolean!
    data: DynamicReportNodeData!
  }

  " data of a single node of dynamic report template "
  type DynamicReportNodeData {
    descendantSortCodes: [Int!]
    descendantFinancialEntities: [UUID!]
    mergedSortCodes: [Int!]
    isOpen: Boolean!
    hebrewText: String
  }
`;
