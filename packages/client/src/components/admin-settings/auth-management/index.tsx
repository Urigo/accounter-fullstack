import { useContext, type ReactElement } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { UserContext } from '@/providers/index.js';
import { ROUTES } from '@/router/routes.js';
import { ApiKeysTab } from './api-keys-tab.js';

export function AuthManagement(): ReactElement {
  const { businessId } = useParams<{ businessId: string }>();
  const { userContext } = useContext(UserContext);
  const adminBusinessId = userContext?.context.adminBusinessId;

  // Access Management is admin-only and scoped to the admin's own business.
  // The backend independently enforces business_owner authorization, but we
  // also guard the route client-side to avoid rendering it for other users.
  if (!adminBusinessId || adminBusinessId !== businessId) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Access Management</h1>
      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="api-keys">
          <ApiKeysTab />
        </TabsContent>
        <TabsContent value="invitations">
          <p className="text-sm text-muted-foreground">Invitations management coming soon.</p>
        </TabsContent>
        <TabsContent value="users">
          <p className="text-sm text-muted-foreground">Users management coming soon.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
