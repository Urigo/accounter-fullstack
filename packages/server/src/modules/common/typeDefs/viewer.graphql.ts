import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " the caller's own identity and provisioning state; null when the request carries no valid credentials "
    viewer: Viewer
  }

  " provisioning state of the calling identity; membership decides first, so a linked caller is ACTIVE regardless of email verification, and the other states describe why an unlinked caller cannot be matched to a business yet "
  enum ViewerStatus {
    " linked to at least one business; the app is usable "
    ACTIVE
    " not linked, and the email address is unverified — so it cannot be matched to an invitation "
    EMAIL_UNVERIFIED
    " not linked, with a verified email; awaiting an invitation "
    NO_WORKSPACE
  }

  " the calling identity, exposing nothing beyond the caller's own credentials " # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- identity of the caller; has no addressable id
  type Viewer {
    email: String
    emailVerified: Boolean!
    status: ViewerStatus!
    " whether the caller is a platform super-admin, who may create new client tenants; false for a caller linked to no business "
    isSuperAdmin: Boolean!
    " whether an open invitation exists for the caller's own email; computed only for a caller linked to no business (false otherwise), so the app can send them to their invitation link "
    hasPendingInvitation: Boolean!
  }
`;
