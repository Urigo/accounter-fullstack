import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    dynamicReport(name: String!): DynamicReportInfo! @auth(role: ACCOUNTANT)
    allDynamicReports: [DynamicReportInfo!]! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateDynamicReportTemplate(name: String!, template: String!): DynamicReportInfo!
      @auth(role: ACCOUNTANT)
    updateDynamicReportTemplateName(name: String!, newName: String!): DynamicReportInfo!
      @auth(role: ACCOUNTANT)
    insertDynamicReportTemplate(name: String!, template: String!): DynamicReportInfo!
      @auth(role: ACCOUNTANT)
    deleteDynamicReportTemplate(name: String!): String! @auth(role: ACCOUNTANT)
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
