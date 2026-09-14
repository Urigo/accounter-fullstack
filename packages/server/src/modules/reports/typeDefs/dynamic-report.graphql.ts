import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    dynamicReport(name: String!): DynamicReportInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    allDynamicReports: [DynamicReportInfo!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    dynamicReportSnapshot(id: UUID!): DynamicReportSnapshot
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type Mutation {
    updateDynamicReportTemplate(
      name: String!
      template: String!
      snapshot: DynamicReportSnapshotInput
    ): DynamicReportInfo! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateDynamicReportTemplateName(name: String!, newName: String!): DynamicReportInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    insertDynamicReportTemplate(
      name: String!
      template: String!
      snapshot: DynamicReportSnapshotInput
    ): DynamicReportInfo! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    deleteDynamicReportTemplate(name: String!): String!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    lockDynamicReportTemplate(name: String!): DynamicReportInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    unlockDynamicReportTemplate(name: String!): DynamicReportInfo!
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
    isLocked: Boolean!
    " period this report was built for; null for templates saved before periods were tracked "
    fromDate: TimelessDate
    " period this report was built for; null for templates saved before periods were tracked "
    toDate: TimelessDate
    " saved baselines, newest first "
    snapshots: [DynamicReportSnapshotMeta!]!
  }

  " a saved baseline, without its payload — enough to populate a picker "
  type DynamicReportSnapshotMeta {
    id: UUID!
    createdAt: DateTime!
    createdBy: String
    fromDate: TimelessDate!
    toDate: TimelessDate!
  }

  " a saved baseline: the report tree and its figures as they stood at that save "
  type DynamicReportSnapshot {
    id: UUID!
    createdAt: DateTime!
    createdBy: String
    fromDate: TimelessDate!
    toDate: TimelessDate!
    " the owner the sums were queried for, which need not be the template's owner "
    scopeOwnerId: UUID!
    tree: [DynamicReportNode!]!
    " leaf values only; branch sums are recomputed from these "
    values: [DynamicReportSnapshotValue!]!
  }

  " one financial entity's value at the moment of a save "
  type DynamicReportSnapshotValue {
    entityId: UUID!
    value: Float!
  }

  " the figures on screen at save time, captured as the baseline for later diffs "
  input DynamicReportSnapshotInput {
    fromDate: TimelessDate!
    toDate: TimelessDate!
    scopeOwnerId: UUID!
    values: [DynamicReportSnapshotValueInput!]!
  }

  " one financial entity's value at the moment of a save "
  input DynamicReportSnapshotValueInput {
    entityId: UUID!
    value: Float!
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
    nodeType: String!
    isOpen: Boolean!
    hebrewText: String
    sortCode: Int
  }
`;
