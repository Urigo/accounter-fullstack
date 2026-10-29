import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { BadgeCheck, CircleAlert, Landmark, MapPin, SearchX, WandSparkles } from 'lucide-react';
import { useQuery } from 'urql';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import {
  IsraeliCorporationLookupDocument,
  type IsraeliCorporationLookupQuery,
} from '@/gql/graphql.js';
import { formatTimelessDate } from '@/helpers/dates.js';
import { isValidIsraeliId, normalizeIsraeliId } from '@/helpers/israeli-id.js';
import { cn } from '@/lib/utils.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query IsraeliCorporationLookup($corporationNumber: String!) {
    israeliCorporation(corporationNumber: $corporationNumber) {
      id
      name
      englishName
      status
      subStatus
      corporationType
      contactType
      limitType
      purpose
      registrationDate
      lastAnnualReport
      isGovernmental
      violations
      address {
        street
        houseNumber
        city
        zipCode
        country
      }
    }
  }
`;

const LOOKUP_DEBOUNCE_MS = 500;
/** The registry's status for an active company */
const ACTIVE_STATUS = 'פעילה';

type IsraeliCorporation = NonNullable<IsraeliCorporationLookupQuery['israeliCorporation']>;

/** Business form fields that can be filled from the registry */
export const REGISTRY_FORM_FIELDS = ['localName', 'address', 'city', 'zipCode'] as const;
export type RegistryFormFields = Partial<Record<(typeof REGISTRY_FORM_FIELDS)[number], string>>;

export function registryToFormFields(corporation: IsraeliCorporation): RegistryFormFields {
  const { street, houseNumber, city, zipCode } = corporation.address ?? {};
  return {
    localName: corporation.name,
    address: [street, houseNumber].filter(Boolean).join(' ') || undefined,
    city: city ?? undefined,
    zipCode: zipCode ?? undefined,
  };
}

function formatAddress(address: IsraeliCorporation['address']): string | null {
  if (!address) {
    return null;
  }
  const streetLine = [address.street, address.houseNumber].filter(Boolean).join(' ');
  const cityLine = [address.city, address.zipCode].filter(Boolean).join(' ');
  return [streetLine, cityLine].filter(Boolean).join(', ') || null;
}

/** Validation feedback for a number we won't look up */
function invalidIdMessage(id: string): string | null {
  if (!/^\d+$/.test(id)) {
    return 'An Israeli company number has digits only.';
  }
  if (id.length < 9) {
    // Still typing
    return null;
  }
  if (id.length > 9) {
    return 'An Israeli company number has 9 digits.';
  }
  if (!isValidIsraeliId(id)) {
    return "This number's check digit doesn't match — it may contain a typo.";
  }
  return null;
}

function Notice({
  icon,
  tone,
  children,
}: {
  icon: ReactNode;
  tone: 'muted' | 'warning';
  children: ReactNode;
}): ReactElement {
  return (
    <div
      role="status"
      className={cn(
        'md:col-span-2 flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
        tone === 'warning'
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'bg-muted/30 text-muted-foreground',
      )}
    >
      {icon}
      <div>{children}</div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function CorporationCard({
  corporation,
  onApply,
}: {
  corporation: IsraeliCorporation;
  onApply?: (fields: RegistryFormFields) => void;
}): ReactElement {
  const isActive = corporation.status === ACTIVE_STATUS;
  const kind = [corporation.contactType, corporation.corporationType, corporation.limitType]
    .filter(Boolean)
    .join(' · ');
  const address = formatAddress(corporation.address);

  return (
    <div className="md:col-span-2 space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <BadgeCheck className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              Found in the Israeli Corporations Registry
            </p>
            <p className="truncate font-medium">
              <span dir="rtl">{corporation.name}</span>
            </p>
            {corporation.englishName && (
              <p className="truncate text-xs text-muted-foreground">{corporation.englishName}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {corporation.status && (
            <Badge
              dir="rtl"
              className={cn(
                'border-transparent',
                isActive ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800',
              )}
            >
              {[corporation.status, corporation.subStatus].filter(Boolean).join(' · ')}
            </Badge>
          )}
          {corporation.isGovernmental && (
            <Badge variant="outline">
              <Landmark aria-hidden />
              Governmental
            </Badge>
          )}
          {corporation.violations && (
            <Badge variant="destructive" dir="rtl">
              {corporation.violations}
            </Badge>
          )}
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        {kind && (
          <Detail label="Type">
            <span dir="rtl">{kind}</span>
          </Detail>
        )}
        {corporation.registrationDate && (
          <Detail label="Registered">
            {formatTimelessDate(corporation.registrationDate, 'dd/MM/yyyy')}
          </Detail>
        )}
        {corporation.lastAnnualReport != null && (
          <Detail label="Last annual report">{corporation.lastAnnualReport}</Detail>
        )}
      </dl>

      {(address || corporation.purpose || onApply) && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
            {address && (
              <p className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span dir="rtl" className="truncate">
                  {address}
                </span>
              </p>
            )}
            {corporation.purpose && (
              <p className="truncate" title={corporation.purpose}>
                Purpose: <span dir="rtl">{corporation.purpose}</span>
              </p>
            )}
          </div>
          {onApply && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onApply(registryToFormFields(corporation))}
            >
              <WandSparkles className="size-3.5" aria-hidden />
              Fill empty fields
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Looks an Israeli government ID up in the Corporations Registry and shows what it finds.
 * Informational only: neither a miss nor a failed lookup blocks the form.
 */
export function IsraeliCorporationLookup({
  govId,
  onApply,
}: {
  govId?: string | null;
  /** When set, the found card offers to fill the business form's empty fields */
  onApply?: (fields: RegistryFormFields) => void;
}): ReactElement | null {
  const id = normalizeIsraeliId(govId ?? '');
  const invalidMessage = id ? invalidIdMessage(id) : null;
  const lookupId = id.length === 9 && !invalidMessage ? id : null;

  const [debouncedId, setDebouncedId] = useState(lookupId);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedId(lookupId);
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
    };
  }, [lookupId]);

  const [{ data, fetching, error }] = useQuery({
    query: IsraeliCorporationLookupDocument,
    variables: { corporationNumber: debouncedId ?? '' },
    pause: !debouncedId || debouncedId !== lookupId,
  });

  if (invalidMessage) {
    return (
      <Notice
        tone="warning"
        icon={<CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
      >
        {invalidMessage}
      </Notice>
    );
  }
  if (!lookupId) {
    return null;
  }

  // urql keeps the previous number's data while a new lookup is pending
  const corporation = data?.israeliCorporation;
  const isPending =
    debouncedId !== lookupId ||
    fetching ||
    (!error && data === undefined) ||
    (!!corporation && corporation.id !== lookupId);

  if (isPending) {
    return (
      <Notice tone="muted" icon={<Spinner className="mt-0.5 size-3.5 shrink-0" aria-hidden />}>
        Checking the Israeli Corporations Registry…
      </Notice>
    );
  }
  if (error) {
    return (
      <Notice tone="muted" icon={<CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />}>
        Couldn&apos;t reach the Israeli Corporations Registry right now. You can still save the
        business.
      </Notice>
    );
  }
  if (!corporation) {
    return (
      <Notice tone="warning" icon={<SearchX className="mt-0.5 size-3.5 shrink-0" aria-hidden />}>
        No company with this number in the Israeli Corporations Registry. Sole proprietors,
        partnerships and non-profits aren&apos;t listed there — you can still save the business.
      </Notice>
    );
  }
  return <CorporationCard corporation={corporation} onApply={onApply} />;
}
