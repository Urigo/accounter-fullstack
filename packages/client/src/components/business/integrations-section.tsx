import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Mail, MapPin, Phone, Plus, Settings, XCircle } from 'lucide-react';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Skeleton } from '@/components/ui/skeleton.js';
import {
  ClientIntegrationsSectionFragmentDoc,
  ClientIntegrationsSectionGreenInvoiceDocument,
  type ClientUpdateInput,
} from '@/gql/graphql.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import { useUpdateClient } from '@/hooks/use-update-client.js';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ClientIntegrationsSection on LtdFinancialEntity {
    id
    clientInfo {
      id
      greenInvoiceId
      hiveId
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ClientIntegrationsSectionGreenInvoice($clientId: UUID!) {
    greenInvoiceClient(clientId: $clientId) {
      id
      country
      emails
      name
      phone
      taxId
      address
      city
      zip
      fax
      mobile
    }
  }
`;

const generalIntegrations = [
  {
    id: 'hive',
    name: 'Hive',
    description:
      'Schema registry, analytics, metrics and gateway for GraphQL federation and other GraphQL APIs',
    status: 'disconnected',
    lastSync: 'Never',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team communication and notifications',
    status: 'disconnected',
    lastSync: 'Never',
  },
  {
    id: 'retool',
    name: 'Retool',
    description: 'Internal tools and dashboards',
    status: 'disconnected',
    lastSync: 'Never',
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Issue tracking and project management',
    status: 'disconnected',
    lastSync: 'Never',
  },
  {
    id: 'workflowy',
    name: 'Workflowy',
    description: 'Task management and note taking',
    status: 'disconnected',
    lastSync: 'Never',
  },
];

interface Props {
  data?: FragmentType<typeof ClientIntegrationsSectionFragmentDoc>;
}

export function IntegrationsSection({ data }: Props) {
  const business = getFragmentData(ClientIntegrationsSectionFragmentDoc, data);

  const [{ data: greenInvoiceData, fetching: fetchingGreenInvoice }, fetchGreenInvoice] = useQuery({
    query: ClientIntegrationsSectionGreenInvoiceDocument,
    variables: {
      clientId: business?.id ?? '',
    },
    pause: !business?.clientInfo?.greenInvoiceId || !business?.id,
  });

  const { updateClient } = useUpdateClient();

  const updateIdByAttribute = useCallback(
    (id: string, attribute: keyof Pick<ClientUpdateInput, 'greenInvoiceId' | 'hiveId'>) => {
      if (!business?.id) return;

      const fields: ClientUpdateInput = {};
      fields[attribute] = id;
      updateClient({
        businessId: business?.id,
        fields,
      });
    },
    [business?.id, updateClient],
  );

  useEffect(() => {
    if (business?.clientInfo?.greenInvoiceId && business?.id) {
      fetchGreenInvoice();
    }
  }, [business?.clientInfo?.greenInvoiceId, business?.id, fetchGreenInvoice]);

  const greenInvoiceClient = greenInvoiceData?.greenInvoiceClient;

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
      <CardContent className="space-y-6">
        <Accordion type="multiple" defaultValue={['green-invoice']} className="space-y-4">
          {/* Green Invoice Integration */}
          {fetchingGreenInvoice ? (
            <AccordionItem
              value="green-invoice"
              className="rounded-lg border-2 border-green-600/20 bg-green-600/5"
            >
              <div className="px-4 py-3 bg-green-600/10 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-5 w-5 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-64" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </div>

              <AccordionContent>
                <div className="p-6 space-y-6">
                  {/* Business Information Skeleton */}
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-40" />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </div>

                  {/* Contact Information Skeleton */}
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-40" />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-6 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </div>

                  {/* Address Information Skeleton */}
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-40" />
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : (
            <AccordionItem
              value="green-invoice"
              className="rounded-lg border-2 border-green-600/20 bg-green-600/5"
            >
              <div className="px-4 py-3 bg-green-600/10 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold">
                      GI
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">Green Invoice</h3>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Israeli invoicing system integration
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <UpdateIntegrationConfigDialog
                      id={business?.clientInfo?.greenInvoiceId}
                      provider="Green Invoice"
                      updateClient={async newId => updateIdByAttribute(newId, 'greenInvoiceId')}
                    />
                    <AccordionTrigger className="hover:no-underline p-2" />
                  </div>
                </div>
              </div>

              <AccordionContent>
                {greenInvoiceClient && (
                  <div className="p-6 space-y-6">
                    {/* Business Information */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        Business Information
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">
                            Integration ID
                          </span>
                          <p className="text-sm font-mono">
                            {business?.clientInfo?.greenInvoiceId}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">
                            Business Name
                          </span>
                          <p className="text-sm">{greenInvoiceClient.name}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">Country</span>
                          <p className="text-sm">{greenInvoiceClient.country}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">Tax ID</span>
                          <p className="text-sm font-mono">{greenInvoiceClient.taxId}</p>
                        </div>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        Contact Information
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5" />
                            Email Addresses
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {greenInvoiceClient.emails?.map((email, index) => (
                              <span key={index} className="text-sm px-2 py-1 bg-muted rounded">
                                {email}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5" />
                            Phone
                          </span>
                          <p className="text-sm font-mono">{greenInvoiceClient.phone}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">Mobile</span>
                          <p className="text-sm font-mono">{greenInvoiceClient.mobile}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">Fax</span>
                          <p className="text-sm font-mono">{greenInvoiceClient.fax}</p>
                        </div>
                      </div>
                    </div>

                    {/* Address Information */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        Address
                      </h4>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1 md:col-span-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Street Address
                          </span>
                          <p className="text-sm">{greenInvoiceClient.address}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">City</span>
                          <p className="text-sm">{greenInvoiceClient.city}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-muted-foreground">
                            Zip Code
                          </span>
                          <p className="text-sm font-mono">{greenInvoiceClient.zip}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {generalIntegrations.map(integration => (
            <AccordionItem
              key={integration.id}
              value={integration.id}
              className="rounded-lg border"
            >
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
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
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={e => e.stopPropagation()}>
                      <Settings className="h-4 w-4" />
                    </Button>
                    <AccordionTrigger className="hover:no-underline p-2" />
                  </div>
                </div>
              </div>

              <AccordionContent>
                <div className="px-4 pb-4 pt-2 border-t">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Last sync: </span>
                    <span className="font-medium">{integration.lastSync}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

interface updateIntegrationProps {
  id?: string;
  provider: string;
  updateClient: (newId: string) => Promise<void>;
}

function UpdateIntegrationConfigDialog({ id, provider, updateClient }: updateIntegrationProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [updatedId, setUpdatedId] = useState(id);

  const handleSaveConfig = useCallback(async () => {
    console.log(`Saving ${provider} ID: ${updatedId}`);

    await updateClient(updatedId!);

    setIsConfigOpen(false);
  }, [provider, updatedId, updateClient]);

  return (
    <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={e => e.stopPropagation()}>
          <Settings className="h-4 w-4 mr-2" />
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Configure {provider}</DialogTitle>
          <DialogDescription>Update your {provider} integration settings</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="id">{provider} ID</Label>
            <Input
              id="id"
              value={updatedId}
              onChange={e => setUpdatedId(e.target.value)}
              placeholder={`Enter ${provider} ID`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveConfig} disabled={!updatedId}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
