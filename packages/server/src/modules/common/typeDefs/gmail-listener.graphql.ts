import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    gmailListenerStatus: Boolean! @auth(role: ADMIN)
  }

  extend type Mutation {
    startGmailListener: Boolean! @auth(role: ADMIN)
    digestGmailMessages: Boolean! @auth(role: ADMIN)
    stopGmailListener: Boolean! @auth(role: ADMIN)
  }
`;
