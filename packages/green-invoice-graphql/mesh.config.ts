import { defineConfig } from '@graphql-mesh/compose-cli';
import { loadJSONSchemaSubgraph } from '@omnigraph/json-schema';

const schemaRef = (definition: string) => `./json-schemas/greenInvoice.json#/$defs/${definition}`;

/**
 * Composes the Green Invoice REST API into a GraphQL supergraph (`yarn generate`). The JSON schemas are
 * only read here, at compose time; the runtime works from the generated supergraph.
 */
export const composeConfig = defineConfig({
  // resolve the JSON-schema refs from the package root, wherever `mesh-compose` is run from
  cwd: import.meta.dirname,
  subgraphs: [
    {
      sourceHandler: loadJSONSchemaSubgraph('GreenInvoice', {
        endpoint: 'https://api.greeninvoice.co.il/api/v1',
        operationHeaders: {
          Authorization: 'Bearer {context.authToken}',
          'Content-Type': 'application/json',
        },
        operations: [
          // documents
          {
            type: 'Query',
            field: 'getDocument',
            path: '/documents/{args.id}',
            method: 'GET',
            argTypeMap: {
              id: {
                type: 'string',
                nullable: false,
              },
            },
            responseSchema: schemaRef('getDocumentResponse'),
          },
          {
            type: 'Query',
            field: 'searchDocuments',
            path: '/documents/search',
            method: 'POST',
            requestSchema: schemaRef('searchDocumentsRequest'),
            responseSchema: schemaRef('searchDocumentsResponse'),
          },
          {
            type: 'Query',
            field: 'previewDocument',
            path: '/documents/preview',
            method: 'POST',
            requestSchema: schemaRef('previewDocumentRequest'),
            responseSchema: schemaRef('previewDocumentResponse'),
          },
          {
            type: 'Query',
            field: 'getLinkedDocuments',
            path: '/documents/{args.id}/linked',
            method: 'GET',
            argTypeMap: {
              id: {
                type: 'string',
                nullable: false,
              },
            },
            responseSchema: schemaRef('getLinkedDocumentsResponse'),
          },
          {
            type: 'Query',
            field: 'getDocumentsDownloadLinks',
            path: '/documents/{args.id}/download/links',
            method: 'GET',
            argTypeMap: {
              id: {
                type: 'string',
                nullable: false,
              },
            },
            responseSchema: schemaRef('getDocumentsDownloadLinksResponse'),
          },
          {
            type: 'Mutation',
            field: 'addDocument',
            path: '/documents',
            method: 'POST',
            requestSchema: schemaRef('addDocumentRequest'),
            responseSchema: schemaRef('addDocumentResponse'),
          },
          {
            type: 'Mutation',
            field: 'closeDocument',
            path: '/documents/{args.id}/close',
            method: 'POST',
            argTypeMap: {
              id: {
                type: 'string',
                nullable: false,
              },
            },
            responseByStatusCode: {
              '200': {
                responseSchema: schemaRef('closeDocumentResponse'),
              },
            },
          },
          // expenses
          {
            type: 'Query',
            field: 'getExpense',
            path: '/expenses/{args.id}',
            method: 'GET',
            argTypeMap: {
              id: {
                type: 'string',
                nullable: false,
              },
            },
            responseSchema: schemaRef('getExpenseResponse'),
          },
          {
            type: 'Query',
            field: 'searchExpenses',
            path: '/expenses/search',
            method: 'POST',
            requestSchema: schemaRef('searchExpensesRequest'),
            responseSchema: schemaRef('searchExpensesResponse'),
          },
          {
            type: 'Mutation',
            field: 'addExpense',
            path: '/expenses',
            method: 'POST',
            requestSchema: schemaRef('addExpenseRequest'),
            responseSchema: schemaRef('addExpenseResponse'),
          },
          {
            type: 'Mutation',
            field: 'updateExpense',
            path: '/expenses/{args.id}',
            method: 'PUT',
            requestSchema: schemaRef('updateExpenseRequest'),
            responseSchema: schemaRef('updateExpenseResponse'),
          },
          // expense drafts
          {
            type: 'Query',
            field: 'searchExpenseDrafts',
            path: '/expenses/drafts/search',
            method: 'POST',
            requestSchema: schemaRef('searchExpenseDraftsRequest'),
            responseByStatusCode: {
              '200': {
                responseSchema: schemaRef('searchExpenseDraftsResponse'),
              },
              '201': {
                responseSchema: schemaRef('searchExpenseDraftsResponse'),
              },
              '404': {
                responseSchema: schemaRef('generalErrorResponse'),
              },
            },
          },
          {
            type: 'Mutation',
            field: 'addExpenseDraftByFile',
            path: '/expenses/file',
            method: 'POST',
            requestSchema: schemaRef('addExpenseDraftByFileRequest'),
            responseByStatusCode: {
              '200': {
                responseSchema: schemaRef('addExpenseDraftByFileResponse'),
              },
              '201': {
                responseSchema: schemaRef('addExpenseDraftByFileResponse'),
              },
              '400': {
                responseSchema: schemaRef('generalErrorResponse'),
              },
              '404': {
                responseSchema: schemaRef('generalErrorResponse'),
              },
              '405': {
                responseSchema: schemaRef('generalErrorResponse'),
              },
            },
          },
          // clients
          {
            type: 'Query',
            field: 'getClient',
            path: '/clients/{args.id}',
            method: 'GET',
            argTypeMap: {
              id: {
                type: 'string',
                nullable: false,
              },
            },
            responseSchema: schemaRef('getClientResponse'),
          },
          {
            type: 'Mutation',
            field: 'addClient',
            path: '/clients',
            method: 'POST',
            requestSchema: schemaRef('addClientRequest'),
            responseSchema: schemaRef('addClientResponse'),
          },
          {
            type: 'Mutation',
            field: 'updateClient',
            path: '/clients/{args.id}',
            method: 'PUT',
            argTypeMap: {
              id: {
                type: 'string',
                nullable: false,
              },
            },
            requestSchema: schemaRef('updateClientRequest'),
            responseSchema: schemaRef('updateClientResponse'),
          },
          {
            type: 'Mutation',
            field: 'deleteClient',
            path: '/clients/{args.id}',
            method: 'DELETE',
            argTypeMap: {
              id: {
                type: 'string',
                nullable: false,
              },
            },
            responseSchema: schemaRef('deleteClientResponse'),
          },
        ],
      }),
    },
    {
      sourceHandler: loadJSONSchemaSubgraph('GreenInvoiceNew', {
        endpoint: 'https://apigw.greeninvoice.co.il',
        operationHeaders: {
          Authorization: 'Bearer {context.authToken}',
          'Content-Type': 'application/json',
        },
        operations: [
          {
            type: 'Query',
            field: 'getFileUploadUrl',
            path: '/file-upload/v1/url',
            method: 'GET',
            argTypeMap: {
              context: {
                type: 'string',
              },
              data: {
                type: 'object',
                properties: {
                  source: {
                    type: 'integer',
                  },
                  id: {
                    type: 'string',
                  },
                  state: {
                    type: 'string',
                  },
                },
                required: ['source'],
              },
            },
            // @ts-expect-error -- per-operation `queryStringOptions` is honored by @omnigraph/json-schema
            // (it replaces the source-level one), but its operation type doesn't declare it yet
            queryStringOptions: {
              jsonStringify: true,
            },
            queryParamArgMap: {
              context: 'context',
              data: 'data',
            },
            responseSchema: schemaRef('getFileUploadUrlResponse'),
          },
          {
            type: 'Query',
            field: 'getBankTransactions',
            path: '/open-banking/v2/transactions',
            method: 'GET',
            argTypeMap: {
              valueDate: {
                type: 'object',
                properties: {
                  from: {
                    type: 'string',
                  },
                  to: {
                    type: 'string',
                  },
                },
                required: ['from', 'to'],
              },
              from: {
                type: 'number',
              },
              size: {
                type: 'number',
              },
              bookingStatus: {
                type: 'string',
              },
            },
            // @ts-expect-error -- per-operation `queryStringOptions` is honored by @omnigraph/json-schema
            // (it replaces the source-level one), but its operation type doesn't declare it yet
            queryStringOptions: {
              indices: true,
              arrayFormat: 'brackets',
            },
            queryParamArgMap: {
              valueDate: 'valueDate',
              from: 'from',
              size: 'size',
              bookingStatus: 'bookingStatus',
            },
            responseSchema: schemaRef('getBankTransactionsResponse'),
          },
        ],
      }),
    },
  ],
});
