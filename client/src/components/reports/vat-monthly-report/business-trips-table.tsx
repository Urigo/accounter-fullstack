import { Dispatch, ReactElement, SetStateAction, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { VatReportBusinessTripsFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { AllChargesTable } from '../../all-charges/all-charges-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VatReportBusinessTripsFields on VatReportResult {
    businessTrips {
      id
      ...AllChargesTableFields
    }
  }
`;

interface Props {
  data?: FragmentType<typeof VatReportBusinessTripsFieldsFragmentDoc>;
  setEditChargeId: Dispatch<SetStateAction<string | undefined>>;
  setInsertDocument: React.Dispatch<React.SetStateAction<string | undefined>>;
  setUploadDocument: React.Dispatch<React.SetStateAction<string | undefined>>;
  setMatchDocuments: React.Dispatch<
    React.SetStateAction<{ id: string; ownerId: string } | undefined>
  >;
}

export const BusinessTripsTable = ({
  data,
  setEditChargeId,
  setInsertDocument,
  setUploadDocument,
  setMatchDocuments,
}: Props): ReactElement => {
  const chargesData = getFragmentData(VatReportBusinessTripsFieldsFragmentDoc, data);
  const [isOpened, setIsOpened] = useState(true);

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <ActionIcon variant="default" onClick={(): void => setIsOpened(i => !i)} size={30}>
          {isOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
        </ActionIcon>
        Business Trips
      </span>
      {isOpened && chargesData && (
        <AllChargesTable
          setEditChargeId={setEditChargeId}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          setUploadDocument={setUploadDocument}
          data={chargesData.businessTrips}
          isAllOpened={false}
        />
      )}
    </>
  );
};
