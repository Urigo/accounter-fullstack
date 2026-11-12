import { toast } from 'sonner';
import type { OperationResult } from 'urql';

/**
 * Query context for operations that report their own failures inline (e.g. a lookup whose
 * component shows a notice), so a failure doesn't also raise a global toast. Module-level so the
 * object stays referentially stable: urql treats `context` as a hook dependency.
 */
export const SUPPRESS_ERROR_TOAST_CONTEXT = { suppressErrorToast: true };

export function handleUrqlError(result: OperationResult) {
  // Operations that opted out own their error reporting, network errors included.
  if (result.operation?.context?.suppressErrorToast) {
    return;
  }

  // Handle network errors
  if (result.error?.networkError) {
    console.error('Network Error:', result.error.networkError);
    toast.error('Network Error', {
      description: 'Failed to connect to the server. Please check your connection.',
      duration: 5000,
    });
    return;
  }

  // Mutations own their error reporting: every mutation hook in `src/hooks/`
  // runs its result through `handleCommonErrors`, which toasts an
  // entity-scoped message under a stable id, so the loading toast it replaces
  // never stacks. Toasting again here produced two notifications per failure —
  // this generic one and the specific one — with only the generic one able to
  // say nothing useful. Network errors are handled above and deliberately stay
  // ours: `handleCommonErrors` can only report those as "Error occurred".
  if (result.operation?.kind === 'mutation') {
    return;
  }

  // Handle common GraphQL errors with toast notifications
  if (result.error?.graphQLErrors?.length) {
    const graphqlError = result.error.graphQLErrors[0];
    const { message } = graphqlError;

    // An unprovisioned account fails every guarded operation at once. The
    // /welcome screen explains it; a toast per failed query would only be noise.
    if (graphqlError.extensions?.code === 'ONBOARDING_REQUIRED') {
      return;
    }

    // Show toast for common GraphQL errors
    console.error('GraphQL Error:', graphqlError);
    toast.error('Operation Error', {
      description: message || 'An error occurred while processing your request.',
      duration: 5000,
    });
  }
}
