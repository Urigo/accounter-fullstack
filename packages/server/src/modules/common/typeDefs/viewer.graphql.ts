import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " the caller's own identity and provisioning state; null when the request carries no valid credentials "
    viewer: Viewer
  }

  " provisioning state of the calling identity "
  enum ViewerStatus {
    " linked to at least one business; the app is usable "
    ACTIVE
    " authenticated, but the identity provider has not verified the email address yet "
    EMAIL_UNVERIFIED
    " authenticated and verified, but not linked to any business "
    NO_WORKSPACE
  }

  " the calling identity, exposing nothing beyond the caller's own credentials " # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- identity of the caller; has no addressable id
  type Viewer {
    email: String
    emailVerified: Boolean!
    status: ViewerStatus!
  }
`;
