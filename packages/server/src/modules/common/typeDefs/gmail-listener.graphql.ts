import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    gmailListenerStatus: Boolean! @requiresAuth @requiresRole(role: "business_owner")
  }

  extend type Mutation {
    startGmailListener: Boolean! @requiresAuth @requiresRole(role: "business_owner")
    digestGmailMessages: Boolean! @requiresAuth @requiresRole(role: "business_owner")
    stopGmailListener: Boolean! @requiresAuth @requiresRole(role: "business_owner")
  }
`;
