export const REQUEST_INGEST_CONTROL_MUTATION = /* GraphQL */ `
  mutation RequestIngestControl($input: IngestControlInput!) {
    requestIngestControl(input: $input) {
      __typename
      ... on IngestControlDecision {
        id
        tenantId
        decisionId
        auditId
        grant {
          id
          jti
          tenantId
          action
          expiresAt
        }
        businessEmailConfig {
          businessId
          internalEmailLinks
          emailBody
          attachments
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

export const INGEST_EMAIL_MUTATION = /* GraphQL */ `
  mutation IngestEmail($input: IngestEmailInput!) {
    ingestEmail(input: $input) {
      __typename
      ... on IngestEmailSuccess {
        outcome
        ingestId
        existingIngestId
        auditId
        reasonCode
      }
      ... on CommonError {
        message
      }
    }
  }
`;
