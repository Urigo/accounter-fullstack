import type { ReactElement } from 'react';
import { differenceInDays, format, setHours } from 'date-fns';
import { ROUTES } from '@/router/routes.js';
import { BusinessTripReportHeaderFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { CopyToClipboardButton } from '../../index.js';
import { AccountantApproval } from '../buttons/accountant-approval.js';
import { BusinessTripToggleMenu } from './business-trip-toggle-menu.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportHeaderFields on BusinessTrip {
    id
    name
    dates {
      start
      end
    }
    purpose
    destination {
      id
      name
    }
    ...BusinessTripAccountantApprovalFields
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportHeaderFieldsFragmentDoc>;
  onChange: () => void;
}

export const ReportHeader = ({ data, onChange }: Props): ReactElement => {
  const businessTrip = getFragmentData(BusinessTripReportHeaderFieldsFragmentDoc, data);

  const { name, dates, purpose, destination } = businessTrip;

  // Mantine's 12-column `Grid`, with its own breakpoints preserved: `Grid.Col`'s xl/lg/md
  // props are min-width based on Mantine v6's scale (md 992, lg 1200, xl 1408), which does not
  // line up with Tailwind's md/lg/xl (768/1024/1280). Hence the arbitrary `min-[…]` variants —
  // the same call the `SimpleGrid` replacement made, so the migration does not also move the
  // layout. `Grid.Col` defaults to span 12, and `Grid`'s default gutter is 16px.
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 flex flex-row justify-between items-center">
        <div className="text-xl">{name}</div>
        <div className="flex flex-row gap-2">
          <AccountantApproval data={businessTrip} onChange={onChange} />
          <CopyToClipboardButton
            isLink
            content={`${window.location.origin}${ROUTES.BUSINESS_TRIPS.DETAIL(businessTrip.id)}`}
          />
          <BusinessTripToggleMenu businessTripId={businessTrip.id} />
        </div>
      </div>
      <div className="col-span-12 min-[992px]:col-span-6 min-[1200px]:col-span-3 min-[1408px]:col-span-2">
        From Date:
        <div className="text-lg">
          {dates?.start ? format(new Date(dates.start), 'dd/MM/yy') : 'Missing'}
        </div>
      </div>
      <div className="col-span-12 min-[992px]:col-span-6 min-[1200px]:col-span-3 min-[1408px]:col-span-2">
        To Date:
        <div className="text-lg">
          {dates?.end ? format(new Date(dates.end), 'dd/MM/yy') : 'Missing'}
        </div>
      </div>
      <div className="col-span-12 min-[992px]:col-span-6 min-[1200px]:col-span-3 min-[1408px]:col-span-2">
        Destination:
        <div className="text-lg">{destination?.name}</div>
      </div>
      {/* `orderMd={6}` moved this column last from 992px up; every sibling keeps order 0. */}
      <div className="col-span-12 min-[992px]:order-6 min-[1200px]:col-span-6 min-[1408px]:col-span-4">
        Description:
        <div className="text-lg">{purpose}</div>
      </div>
      <div className="col-span-12 min-[992px]:col-span-6 min-[1200px]:col-span-3 min-[1408px]:col-span-2">
        Total Days:
        <div className="text-lg">{dates ? getDaysDiff(dates.start, dates.end) : 'Missing'}</div>
      </div>
    </div>
  );
};

function getDaysDiff(start: string, end: string): number {
  return differenceInDays(setHours(new Date(end), 22), setHours(new Date(start), 6)) + 1;
}
