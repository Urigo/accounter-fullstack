import { OperationTypeNode } from 'graphql';
import { defineConfig } from '@graphql-mesh/compose-cli';
import { loadJSONSchemaSubgraph } from '@omnigraph/json-schema';

export const composeConfig = defineConfig({
  subgraphs: [
    {
      sourceHandler: loadJSONSchemaSubgraph('GreenInvoice', {
        operationHeaders: {
          Authorization: 'Bearer {context.authToken}',
          'Content-Type': 'application/json',
        },
        endpoint: 'https://api.greeninvoice.co.il/api/v1',
        operations: [
          {
            type: OperationTypeNode.MUTATION,
            field: 'addExpense',
            path: '/expenses',
            method: 'POST',
            requestSchema: '../json-schemas/greenInvoice.json#/definitions/addExpenseRequest',
            responseSchema: '../json-schemas/greenInvoice.json#/definitions/addExpenseResponse',
            responseSample: 'https://www.reddit.com/r/AskReddit.json',
          },
          {
            type: OperationTypeNode.QUERY,
            field: 'getExpense',
            path: '/expenses/{args.id}',
            method: 'GET',
            argTypeMap: {
              id: {
                type: 'string',
                nullable: false,
              },
            },
            responseSchema: '../json-schemas/greenInvoice.json#/definitions/getExpenseResponse',
          },
          {
            type: OperationTypeNode.MUTATION,
            field: 'updateExpense',
            path: '/expenses/{args.id}',
            method: 'PUT',
            requestSchema: '../json-schemas/greenInvoice.json#/definitions/updateExpenseRequest',
            responseSchema: '../json-schemas/greenInvoice.json#/definitions/updateExpenseResponse',
          },
          {
            type: OperationTypeNode.QUERY,
            field: 'searchExpenses',
            path: '/expenses/search',
            method: 'POST',
            requestSchema: '../json-schemas/greenInvoice.json#/definitions/searchExpensesRequest',
            responseSchema: '../json-schemas/greenInvoice.json#/definitions/searchExpensesResponse',
          },
          {
            type: OperationTypeNode.QUERY,
            field: 'searchDocuments',
            path: '/documents/search',
            method: 'POST',
            requestSchema: '../json-schemas/greenInvoice.json#/definitions/searchDocumentsRequest',
            responseSchema:
              '../json-schemas/greenInvoice.json#/definitions/searchDocumentsResponse',
          },
          {
            type: OperationTypeNode.MUTATION,
            field: 'addExpenseDraftByFile',
            path: '/expenses/file',
            method: 'POST',
            requestSchema:
              '../json-schemas/greenInvoice.json#/definitions/addExpenseDraftByFileRequest',
            responseByStatusCode: {
              200: {
                responseSchema:
                  '../json-schemas/greenInvoice.json#/definitions/addExpenseDraftByFileResponse',
              },
              201: {
                responseSchema:
                  '../json-schemas/greenInvoice.json#/definitions/addExpenseDraftByFileResponse',
              },
              400: {
                responseSchema:
                  '../json-schemas/greenInvoice.json#/definitions/generalErrorResponse',
              },
              404: {
                responseSchema:
                  '../json-schemas/greenInvoice.json#/definitions/generalErrorResponse',
              },
            },
          },
          {
            type: OperationTypeNode.QUERY,
            field: 'searchExpenseDrafts',
            path: '/expenses/drafts/search',
            method: 'POST',
            requestSchema:
              '../json-schemas/greenInvoice.json#/definitions/searchExpenseDraftsRequest',
            responseByStatusCode: {
              200: {
                responseSchema:
                  '../json-schemas/greenInvoice.json#/definitions/searchExpenseDraftsResponse',
              },
              201: {
                responseSchema:
                  '../json-schemas/greenInvoice.json#/definitions/searchExpenseDraftsResponse',
              },
              404: {
                responseSchema:
                  '../json-schemas/greenInvoice.json#/definitions/generalErrorResponse',
              },
            },
          },
        ],
      }),
    },
  ],
});
