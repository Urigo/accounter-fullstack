import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleSlash,
  LinkIcon,
  Mail,
  MapPin,
  Phone,
  Settings,
  Unlink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Skeleton } from '@/components/ui/skeleton.js';
import {
  ClientIntegrationsSectionFragmentDoc,
  ClientIntegrationsSectionGreenInvoiceDocument,
  type ClientIntegrationsInput,
} from '@/gql/graphql.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import { useUpdateClient } from '@/hooks/use-update-client.js';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../ui/accordion.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.jsx';
import { Input } from '../../ui/input.jsx';
import { Label } from '../../ui/label.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ClientIntegrationsSection on LtdFinancialEntity {
    id
    clientInfo {
      id
      integrations {
        id
        greenInvoiceInfo {
          id
        }
        hiveId
        linearId
        slackChannelKey
        notionId
        workflowyUrl
      }
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

const generalIntegrations: Array<{
  id: keyof ClientIntegrationsInput;
  name: string;
  description: string;
  keyType?: string;
  url: string;
  color?: string;
}> = [
  {
    id: 'linearId',
    name: 'Linear',
    description: 'Issue tracking and project management',
    url: 'https://linear.app/the-guild/customer/[ID]',
    color: 'indigo-500',
  },
  {
    id: 'slackChannelKey',
    name: 'Slack',
    description: 'Team communication and notifications',
    keyType: 'Channel Key',
    url: 'https://guild-oss.slack.com/archives/[ID]',
  },
  {
    id: 'notionId',
    name: 'Notion',
    description: 'Documentation and knowledge management',
    url: 'https://www.notion.so/theguildoss/[ID]',
  },
  {
    id: 'workflowyUrl',
    name: 'Workflowy',
    keyType: 'URL',
    description: 'Task management and note taking',
    url: '[ID]',
  },
];

interface Props {
  data?: FragmentType<typeof ClientIntegrationsSectionFragmentDoc>;
}

export function IntegrationsSection({ data }: Props) {
  const [openSections, setOpenSections] = useState<string[]>([]);
  const business = getFragmentData(ClientIntegrationsSectionFragmentDoc, data);
  const integrations = business?.clientInfo?.integrations;
  const { updateClient } = useUpdateClient();

  const [{ data: greenInvoiceData, fetching: fetchingGreenInvoice }, fetchGreenInvoice] = useQuery({
    query: ClientIntegrationsSectionGreenInvoiceDocument,
    variables: {
      clientId: business?.id ?? '',
    },
    pause:
      !integrations?.greenInvoiceInfo || !business?.id || !openSections.includes('green-invoice'),
  });
  const greenInvoiceClient = greenInvoiceData?.greenInvoiceClient;
  const hiveClient = business?.clientInfo?.integrations?.hiveId;

  const updateIdByAttribute = useCallback(
    (
      id: string,
      attribute: keyof Pick<
        ClientIntegrationsInput,
        'hiveId' | 'greenInvoiceId' | 'linearId' | 'slackChannelKey' | 'notionId' | 'workflowyUrl'
      >,
    ) => {
      if (!business?.id) return;

      const integrations: ClientIntegrationsInput = {};
      integrations[attribute] = id;
      updateClient({
        businessId: business?.id,
        fields: { integrations },
      });
    },
    [business?.id, updateClient],
  );

  useEffect(() => {
    if (
      integrations?.greenInvoiceInfo?.id &&
      business?.id &&
      openSections.includes('green-invoice')
    ) {
      fetchGreenInvoice();
    }
  }, [integrations?.greenInvoiceInfo?.id, business?.id, fetchGreenInvoice, openSections]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Connected external services and providers</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={setOpenSections}
          className="space-y-4"
        >
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
                      id={business?.clientInfo?.integrations.greenInvoiceInfo?.id ?? undefined}
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
                            {business?.clientInfo?.integrations.greenInvoiceInfo?.id}
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

          {/* Hive / Retool Integration */}
          {hiveClient && (
            <AccordionItem
              key="hiveId"
              value="hiveId"
              className="rounded-lg border-2 border-green-900/20 bg-green-900/5"
            >
              <div className="px-4 py-3 bg-green-900/10 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {integrations?.hiveId ? (
                      <Link
                        to="https://the-guild.dev/graphql/hive"
                        target="_blank"
                        rel="noreferrer"
                        onClick={event => event.stopPropagation()}
                        className="inline-flex items-center font-semibold"
                      >
                        <div className="h-10 w-10 rounded-lg bg-green-900 flex items-center justify-center text-white font-bold">
                          <img
                            src="/icons/logos/hive.svg"
                            alt="Hive logo"
                            className="size-8 object-cover"
                          />
                        </div>
                      </Link>
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-green-900 flex items-center justify-center text-white font-bold">
                        <Unlink />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">Hive</h3>
                        {integrations?.hiveId == null ? (
                          <CircleSlash className="h-5 w-5 text-red-600" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Schema registry, analytics, metrics and gateway for GraphQL federation and
                        other GraphQL APIs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <UpdateIntegrationConfigDialog
                      id={business?.clientInfo?.integrations.hiveId ?? undefined}
                      provider="Hive"
                      updateClient={async newId => updateIdByAttribute(newId, 'hiveId')}
                    />
                  </div>
                  <AccordionTrigger className="hover:no-underline p-2" />
                </div>
              </div>

              <AccordionContent>
                <div className="flex flex-col gap-4 px-4 pb-4 pt-2 border-t">
                  <div className="text-sm">
                    <Link
                      to="https://the-guild.dev/graphql/hive"
                      target="_blank"
                      rel="noreferrer"
                      onClick={event => event.stopPropagation()}
                      className="inline-flex items-center font-semibold gap-2"
                    >
                      <img
                        src="/icons/logos/hive.svg"
                        alt="Hive logo"
                        className="size-8 object-cover"
                      />
                      Hive
                    </Link>
                  </div>
                  <div className="text-sm">
                    <Link
                      to={`https://graphcdn.retool.com/apps/f6c244bc-b7ce-11ef-a86c-0b05f221c5b4/Hive/Hive%20Admin/explore_organization?id=${integrations.hiveId}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={event => event.stopPropagation()}
                      className="inline-flex items-center font-semibold gap-2"
                    >
                      <img
                        src="../../../icons/logos/retool.svg"
                        alt="Retool logo"
                        className="size-8 object-cover"
                      />
                      Retool
                    </Link>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {generalIntegrations.map(integration => (
            <AccordionItem
              key={integration.id}
              value={integration.id}
              className="rounded-lg border-2 border-gray-500/20 bg-gray-500/5"
            >
              <div className="px-4 py-3 bg-gray-500/10 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {integrations?.[integration.id as keyof typeof integrations] ? (
                      <Link
                        to={integration.url.replace(
                          '[ID]',
                          (integrations?.[integration.id as keyof typeof integrations] as string) ??
                            '',
                        )}
                        target="_blank"
                        rel="noreferrer"
                        onClick={event => event.stopPropagation()}
                        className="inline-flex items-center font-semibold"
                      >
                        <div className="h-10 w-10 rounded-lg bg-gray-500 flex items-center justify-center text-white font-bold">
                          <LinkIcon />
                        </div>
                      </Link>
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-gray-500 flex items-center justify-center text-white font-bold">
                        <Unlink />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{integration.name}</h3>
                        {integrations?.[integration.id as keyof typeof integrations] == null ? (
                          <CircleSlash className="h-5 w-5 text-red-600" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{integration.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <UpdateIntegrationConfigDialog
                      id={
                        business?.clientInfo?.integrations[
                          integration.id as keyof typeof integrations
                        ] ?? undefined
                      }
                      provider={integration.name}
                      keyType={integration.keyType}
                      updateClient={async newId => updateIdByAttribute(newId, integration.id)}
                    />
                    {/* <AccordionTrigger className="hover:no-underline p-2" /> */}
                  </div>
                </div>
              </div>

              {/* <AccordionContent>
                <div className="px-4 pb-4 pt-2 border-t">
                  <div className="text-sm">
                    <Link
                      to={integration.url.replace(
                        '[ID]',
                        (integrations?.[integration.id as keyof typeof integrations] as string) ??
                          '',
                      )}
                      target="_blank"
                      rel="noreferrer"
                      onClick={event => event.stopPropagation()}
                      className="inline-flex items-center font-semibold"
                    >
                      <LinkIcon className="h-4 w-4 mr-2" />
                    </Link>
                  </div>
                </div>
              </AccordionContent> */}
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
  keyType?: string;
  updateClient: (newId: string) => Promise<void>;
}

function UpdateIntegrationConfigDialog({
  id,
  provider,
  keyType,
  updateClient,
}: updateIntegrationProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [updatedId, setUpdatedId] = useState(id);

  const handleSaveConfig = useCallback(async () => {
    await updateClient(updatedId!);

    setIsConfigOpen(false);
  }, [updatedId, updateClient]);

  return (
    <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={e => e.stopPropagation()}>
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Configure {provider}</DialogTitle>
          <DialogDescription>Update your {provider} integration settings</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="id">
              {provider} {keyType ?? 'ID'}
            </Label>
            <Input
              id="id"
              value={updatedId}
              onChange={e => setUpdatedId(e.target.value)}
              placeholder={`Enter ${provider} ${keyType ?? 'ID'}`}
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
