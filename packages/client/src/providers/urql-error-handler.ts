import { toast } from 'sonner';
import type { OperationResult } from 'urql';

export function handleUrqlError(result: OperationResult) {
  // Handle network errors
  if (result.error?.networkError) {
    console.error('Network Error:', result.error.networkError);
    toast.error('Network Error', {
      description: 'Failed to connect to the server. Please check your connection.',
      duration: 5000,
    });
    return;
  }

  // Handle common GraphQL errors with toast notifications
  if (result.error?.graphQLErrors?.length) {
    const graphqlError = result.error.graphQLErrors[0];
    const { message } = graphqlError;

    // Show toast for common GraphQL errors
    console.error('GraphQL Error:', graphqlError);
    toast.error('Operation Error', {
      description: message || 'An error occurred while processing your request.',
      duration: 5000,
    });
  }
}
