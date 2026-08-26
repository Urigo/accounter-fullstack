import { type ReactElement } from 'react';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import { Button } from './ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.js';

/**
 * Global error boundary for router errors
 * Handles different error types and provides appropriate UI
 */
export function ErrorBoundary(): ReactElement {
  const error = useRouteError();

  // Handle route errors (404, 401, 500, etc.)
  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 404:
        return (
          <ErrorLayout
            icon={<AlertCircle className="h-16 w-16 text-yellow-500" />}
            title="Page Not Found"
            description="The page you're looking for doesn't exist."
            statusCode={404}
          >
            <div className="flex gap-4">
              <Link to={ROUTES.HOME}>
                <Button variant="default">
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </Link>
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
            </div>
          </ErrorLayout>
        );

      case 401:
        return (
          <ErrorLayout
            icon={<AlertCircle className="h-16 w-16 text-red-500" />}
            title="Unauthorized"
            description="You need to be logged in to access this page."
            statusCode={401}
          >
            <Link to={ROUTES.LOGIN}>
              <Button variant="default">Go to Login</Button>
            </Link>
          </ErrorLayout>
        );

      case 403:
        return (
          <ErrorLayout
            icon={<AlertCircle className="h-16 w-16 text-red-500" />}
            title="Forbidden"
            description="You don't have permission to access this resource."
            statusCode={403}
          >
            <Link to={ROUTES.HOME}>
              <Button variant="default">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </Link>
          </ErrorLayout>
        );

      case 500:
        return (
          <ErrorLayout
            icon={<AlertCircle className="h-16 w-16 text-red-500" />}
            title="Server Error"
            description="Something went wrong on our end. We're working to fix it."
            statusCode={500}
          >
            <div className="flex gap-4">
              <Button variant="default" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Page
              </Button>
              <Link to={ROUTES.HOME}>
                <Button variant="outline">
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </Link>
            </div>
          </ErrorLayout>
        );

      default:
        return (
          <ErrorLayout
            icon={<AlertCircle className="h-16 w-16 text-orange-500" />}
            title={`Error ${error.status}`}
            description={error.statusText || 'An unexpected error occurred'}
            statusCode={error.status}
          >
            <Link to={ROUTES.HOME}>
              <Button variant="default">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </Link>
          </ErrorLayout>
        );
    }
  }

  // Handle generic JavaScript errors
  const genericError = error as Error;
  const isDevelopment = import.meta.env.DEV;

  return (
    <ErrorLayout
      icon={<AlertCircle className="h-16 w-16 text-red-500" />}
      title="Unexpected Error"
      description="An unexpected error occurred. Please try again."
    >
      {isDevelopment && genericError.message && (
        <Card className="max-w-2xl mt-4 bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-sm text-red-700">Error Details (Dev Only)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-red-600 overflow-auto">
              {genericError.message}
              {genericError.stack && `\n\n${genericError.stack}`}
            </pre>
          </CardContent>
        </Card>
      )}
      <div className="flex gap-4 mt-4">
        <Button variant="default" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reload Page
        </Button>
        <Link to={ROUTES.HOME}>
          <Button variant="outline">
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Button>
        </Link>
      </div>
    </ErrorLayout>
  );
}

/**
 * Reusable error layout component
 */
interface ErrorLayoutProps {
  icon: ReactElement;
  title: string;
  description: string;
  statusCode?: number;
  children?: React.ReactNode;
}

function ErrorLayout({
  icon,
  title,
  description,
  statusCode,
  children,
}: ErrorLayoutProps): ReactElement {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">{icon}</div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {title}
              {statusCode && (
                <span className="ml-2 text-sm text-muted-foreground">({statusCode})</span>
              )}
            </CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}
