import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " every comment thread of a template, with its messages. Fetched on its own so posting never refetches the template "
    dynamicReportThreads(templateName: String!): [DynamicReportThread!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type Mutation {
    " posts a message on a node's thread, creating the thread on first use and reopening it if resolved. Allowed on locked templates "
    addDynamicReportComment(input: AddDynamicReportCommentInput!): DynamicReportThread!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    " edits one of the caller's own messages "
    editDynamicReportComment(id: UUID!, content: String!): DynamicReportComment!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    " soft-deletes one of the caller's own messages "
    deleteDynamicReportComment(id: UUID!): DynamicReportComment!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    setDynamicReportThreadResolved(threadId: UUID!, resolved: Boolean!): DynamicReportThread!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " the kind of report node a thread is attached to "
  enum DynamicReportNodeKind {
    LEAF
    BRANCH
  }

  " the discussion on one report node, shared by every period the template is viewed for "
  type DynamicReportThread {
    id: UUID!
    nodeId: String!
    nodeKind: DynamicReportNodeKind!
    " the node's row text when the thread was last posted to, for a node no longer in the report "
    nodeLabel: String!
    createdAt: DateTime!
    resolvedAt: DateTime
    " display name; null when the user is gone "
    resolvedBy: String
    " oldest first (created_at, id) "
    messages: [DynamicReportComment!]!
  }

  " one message in a dynamic report thread "
  type DynamicReportComment {
    id: UUID!
    " null once deleted "
    content: String
    createdAt: DateTime!
    editedAt: DateTime
    deletedAt: DateTime
    " display name (BusinessUser name ?? email); null → 'a former user' "
    author: String
    " whether the caller wrote this message, and so may edit or delete it "
    isMine: Boolean!
    " the period of the view the message was written in "
    fromDate: TimelessDate!
    " the period of the view the message was written in "
    toDate: TimelessDate!
    " the owner of the view the message was written in "
    scopeOwnerId: UUID!
  }

  " a message to post on a report node's thread "
  input AddDynamicReportCommentInput {
    templateName: String!
    nodeId: String!
    nodeKind: DynamicReportNodeKind!
    " the node's current row text "
    nodeLabel: String!
    content: String!
    fromDate: TimelessDate!
    toDate: TimelessDate!
    scopeOwnerId: UUID!
  }
`;
