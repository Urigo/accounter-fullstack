import type { ExecutionResult } from 'graphql';
import { fetch, FormData } from '@whatwg-node/fetch';
import { env } from './environment.js';
import {
  BusinessEmailConfigQuery,
  BusinessEmailConfigQueryVariables,
  InsertEmailDocumentsMutation,
  InsertEmailDocumentsMutationVariables,
} from './gql/graphql.js';
import { graphql } from './gql/index.js';

const BusinessEmailConfig = graphql(`
  query BusinessEmailConfig($email: String!) {
    businessEmailConfig(email: $email) {
      businessId
      internalEmailLinks
      emailBody
      attachments
    }
  }
`);

const InsertEmailDocuments = graphql(`
  mutation InsertEmailDocuments(
    $documents: [FileScalar!]!
    $userDescription: String!
    $messageId: String
    $businessId: UUID
  ) {
    insertEmailDocuments(
      documents: $documents
      userDescription: $userDescription
      messageId: $messageId
      businessId: $businessId
    )
  }
`);

async function insertEmailDocuments(
  variables: Omit<InsertEmailDocumentsMutationVariables, 'documents'> & { documents: File[] },
) {
  try {
    const formData = new FormData();

    const operations = {
      query: InsertEmailDocuments.toString(),
      variables: {
        ...variables,
        documents: variables.documents.map(() => null),
      },
    };

    const map = Object.fromEntries(
      variables.documents.map((_, i) => [String(i), [`variables.documents.${i}`]]),
    );

    formData.set('operations', JSON.stringify(operations));
    formData.set('map', JSON.stringify(map));

    for (let i = 0; i < variables.documents.length; i += 1) {
      const file = variables.documents[i];
      const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });
      formData.append(String(i), fileBlob, file.name);
    }

    const response = await fetch(env.general.serverUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': env.authorization.apiKey,
        Accept: 'application/graphql-response+json',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const result = (await response.json()) as ExecutionResult<InsertEmailDocumentsMutation>;

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error('Error inserting email documents');
    }

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  } catch (error) {
    console.error('Error executing GraphQL request with files:', error);
    throw error;
  }
}

const businessEmailConfig = async (variables: BusinessEmailConfigQueryVariables) => {
  try {
    const response = await fetch(env.general.serverUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': env.authorization.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/graphql-response+json',
      },
      body: JSON.stringify({
        query: BusinessEmailConfig.toString(),
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const result = (await response.json()) as ExecutionResult<BusinessEmailConfigQuery>;

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error('Error fetching business email config');
    }

    if (!result.data) {
      throw new Error('No data returned from server');
    }

    return result.data;
  } catch (error) {
    console.error('Error executing GraphQL request:', error);
    throw error;
  }
};

export const getServer = () => {
  return {
    businessEmailConfig,
    insertEmailDocuments,
  };
};
