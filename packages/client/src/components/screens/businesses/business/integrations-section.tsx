import { CheckCircle2, Plus, Settings, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';

const integrations = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team communication and notifications',
    status: 'connected',
    lastSync: '2 minutes ago',
  },
  {
    id: 'retool',
    name: 'Retool',
    description: 'Internal tools and dashboards',
    status: 'connected',
    lastSync: '1 hour ago',
  },
  {
    id: 'green-invoice',
    name: 'Green Invoice',
    description: 'Israeli invoicing system integration',
    status: 'connected',
    lastSync: '5 minutes ago',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Accounting software sync',
    status: 'disconnected',
    lastSync: 'Never',
  },
];

export function IntegrationsSection() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Connected external services and providers</CardDescription>
          </div>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map(integration => (
            <div key={integration.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{integration.name}</h4>
                    {integration.status === 'connected' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm">
                  <span className="text-muted-foreground">Last sync: </span>
                  <span className="font-medium">{integration.lastSync}</span>
                </div>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
