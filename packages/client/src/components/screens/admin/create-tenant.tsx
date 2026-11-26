import { useCallback, useState, type ReactElement } from 'react';
import { Building2, Copy } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CountryCode } from '@/helpers/countries.js';
import type { TimelessDateString } from '@/helpers/dates.js';
import { useBootstrapNewClient } from '@/hooks/use-bootstrap-new-client.js';
import { useSessionViewer } from '@/hooks/use-viewer.js';
import { ROUTES } from '@/router/routes.js';
import { ComboBox } from '../../common/inputs/combo-box.js';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert.js';
import { Button } from '../../ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../ui/card.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select.js';

// Roles that may own or run a brand-new tenant. The invitee is its first and only member.
const OWNER_ROLES = [
  { value: 'business_owner', label: 'Business Owner' },
  { value: 'accountant', label: 'Accountant' },
] as const;

const COUNTRY_OPTIONS = Object.entries(CountryCode)
  .map(([label, value]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

const currentYear = new Date().getFullYear();

const formSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required'),
  countryCode: z.string().min(1, 'Country is required'),
  ownerEmail: z.email('Please enter a valid email address'),
  ownerRole: z.enum(['business_owner', 'accountant']),
  dateEstablished: z
    .string()
    .refine(value => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Use YYYY-MM-DD'),
  initialAccounterYear: z
    .string()
    .refine(
      value =>
        value === '' ||
        (/^\d{4}$/.test(value) && Number(value) >= 1990 && Number(value) <= currentYear + 1),
      `Enter a year between 1990 and ${currentYear + 1}`,
    ),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
  businessName: '',
  countryCode: CountryCode.Israel,
  ownerEmail: '',
  ownerRole: 'business_owner',
  dateEstablished: '',
  initialAccounterYear: '',
};

type CreatedTenant = {
  businessId: string;
  businessName: string;
  ownerEmail: string;
  invitationLink: string;
};

/** The link the owner opens to accept: the same route the invitee screen is served on. */
export function invitationLinkFor(token: string, origin = window.location.origin): string {
  return `${origin}${ROUTES.ACCEPT_INVITATION(encodeURIComponent(token))}`;
}

/**
 * Super-admin screen that creates a client tenant (`bootstrapNewClient`) and shows the owner's
 * invitation link to pass on. Accounter sends no invitation email, so the link is the only way
 * the owner gets in.
 */
export function CreateTenantScreen(): ReactElement {
  const { viewer, fetching: viewerFetching } = useSessionViewer();
  const { bootstrapNewClient, fetching } = useBootstrapNewClient();
  const [created, setCreated] = useState<CreatedTenant | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const onSubmit = useCallback(
    async (values: FormValues) => {
      const ownerEmail = values.ownerEmail.trim().toLowerCase();
      const result = await bootstrapNewClient({
        input: {
          businessName: values.businessName.trim(),
          countryCode: values.countryCode,
          ownerEmail,
          ownerRole: values.ownerRole,
          // Validated as YYYY-MM-DD by the schema above.
          dateEstablished: (values.dateEstablished || undefined) as TimelessDateString | undefined,
          initialAccounterYear: values.initialAccounterYear
            ? Number(values.initialAccounterYear)
            : null,
        },
      });
      if (result) {
        setCreated({
          businessId: result.business.id,
          businessName: result.business.name,
          ownerEmail,
          invitationLink: invitationLinkFor(result.invitationToken),
        });
      }
    },
    [bootstrapNewClient],
  );

  const startOver = useCallback(() => {
    setCreated(null);
    form.reset(DEFAULT_VALUES);
  }, [form]);

  if (viewerFetching) {
    return <div />;
  }

  // The server refuses `bootstrapNewClient` to anyone else; this only keeps the form out of sight.
  if (!viewer?.isSuperAdmin) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <Alert variant="destructive">
          <AlertTitle>Super-admin access required</AlertTitle>
          <AlertDescription>Only platform super-admins can create new tenants.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <Card>
          <CardHeader>
            <CardTitle>Tenant created</CardTitle>
            <CardDescription>
              {created.businessName} ({created.businessId})
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm">
              Send this invitation link to <strong>{created.ownerEmail}</strong>. Accounter does not
              email it. The link is valid for 7 days and works only for someone signed in with that
              exact email address.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={created.invitationLink}
                aria-label="Invitation link"
                onFocus={event => event.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(created.invitationLink)}
              >
                <Copy className="size-4" />
                Copy link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This is the only time the link is shown: the server keeps a hash of it, not the link.
            </p>
          </CardContent>
          <CardFooter>
            <Button type="button" variant="outline" onClick={startOver}>
              Create another tenant
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            Create tenant
          </CardTitle>
          <CardDescription>
            Creates a new client business with its default tax categories and authorities, and an
            invitation for its first owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business name</FormLabel>
                    <FormControl>
                      <Input placeholder="Example Ltd." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <ComboBox
                      data={COUNTRY_OPTIONS}
                      value={field.value}
                      onChange={value => field.onChange(value ?? '')}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      placeholder="Select a country"
                      formPart
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ownerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="owner@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ownerRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {OWNER_ROLES.map(role => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dateEstablished"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Established (optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="initialAccounterYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Accounter year (optional)</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" placeholder={String(currentYear)} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={fetching}>
                {fetching ? 'Creating…' : 'Create tenant'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
