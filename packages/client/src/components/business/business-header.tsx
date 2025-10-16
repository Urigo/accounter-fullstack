import { format } from 'date-fns';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { BusinessHeaderFragmentDoc } from '@/gql/graphql.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessHeader on Business {
    __typename
    id
    name
    createdAt
    ... on LtdFinancialEntity {
      governmentId
    }
  }
`;

interface Props {
  data?: FragmentType<typeof BusinessHeaderFragmentDoc>;
}

export function BusinessHeader({ data }: Props) {
  const business = getFragmentData(BusinessHeaderFragmentDoc, data);

  if (!business || business.__typename !== 'LtdFinancialEntity') {
    return <div />;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
              <Building2 className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-foreground">{business.name}</h1>
                {/* TODO: make dynamic, add client badge */}
                <Badge variant="secondary">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">Business ID: {business.id}</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm">
            <div className="text-right">
              <p className="text-muted-foreground">Tax ID</p>
              <p className="font-medium text-foreground">{business.governmentId}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Since</p>
              <p className="font-medium text-foreground">
                {format(business.createdAt, 'MMM yyyy')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
