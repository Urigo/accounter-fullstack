import { gql } from 'graphql-tag';

gql`
  mutation UploadDocument($file: File!, $chargeId: ID) {
    uploadDocument(file: $file, chargeId: $chargeId) {
      __typename
      ... on UploadDocumentSuccessfulResult {
        document {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;
