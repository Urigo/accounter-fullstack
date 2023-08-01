import { Dispatch, SetStateAction, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { VarReportMiscTableFieldsFragmentDoc } from '../../../gql/graphql';
import { AllChargesTable } from '../../all-charges/all-charges-table';

/* GraphQL */ `
  fragment VarReportMiscTableFields on VatReportResult {
    differentMonthDoc {
      id
      ...AllChargesTableFields
    }
  }
`;

type Props = {
  data?: FragmentType<typeof VarReportMiscTableFieldsFragmentDoc>;
  setEditChargeId: Dispatch<SetStateAction<string | undefined>>;
  setInsertDocument: React.Dispatch<React.SetStateAction<string | undefined>>;
  setUploadDocument: React.Dispatch<React.SetStateAction<string | undefined>>;
  setMatchDocuments: React.Dispatch<
    React.SetStateAction<{ id: string; ownerId: string } | undefined>
  >;
};

export const MiscTable = ({
  data,
  setEditChargeId,
  setInsertDocument,
  setUploadDocument,
  setMatchDocuments,
}: Props) => {
  const chargesData = getFragmentData(VarReportMiscTableFieldsFragmentDoc, data);
  const [isOpened, setOpened] = useState(true);

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <ActionIcon variant="default" onClick={() => setOpened(i => !i)} size={30}>
          {isOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
        </ActionIcon>
        Misc Charges (which are not on the above tables)
      </span>
      {isOpened && chargesData && (
        <AllChargesTable
          setEditChargeId={setEditChargeId}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          setUploadDocument={setUploadDocument}
          data={chargesData.differentMonthDoc}
          isAllOpened={false}
        />
      )}
    </>
  );
};
