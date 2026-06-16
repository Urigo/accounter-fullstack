import type { ReactElement } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';

export function AuthManagement(): ReactElement {
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
          <p className="text-sm text-muted-foreground">API keys management coming soon.</p>
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
