import { Dispatch, ReactElement, SetStateAction, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import {
  AllChargesTable,
  AllChargesTableFieldsFragmentDoc,
} from '../../all-charges/all-charges-table.js';

export const VatReportMiscTableFieldsFragmentDoc = graphql(
  `
    fragment VatReportMiscTableFields on VatReportResult {
      differentMonthDoc {
        id
        ...AllChargesTableFields
      }
    }
  `,
  [AllChargesTableFieldsFragmentDoc],
);

type Props = {
  data?: FragmentOf<typeof VatReportMiscTableFieldsFragmentDoc>;
  setEditCharge: Dispatch<SetStateAction<{ id: string; onChange: () => void } | undefined>>;
  setInsertDocument: React.Dispatch<
    React.SetStateAction<{ id: string; onChange: () => void } | undefined>
  >;
  setUploadDocument: React.Dispatch<
    React.SetStateAction<{ id: string; onChange: () => void } | undefined>
  >;
  setMatchDocuments: React.Dispatch<
    React.SetStateAction<{ id: string; ownerId: string } | undefined>
  >;
  toggleMergeCharge: (chargeId: string) => void;
  mergeSelectedCharges: Set<string>;
};

export const MiscTable = ({
  data,
  setEditCharge,
  setInsertDocument,
  setUploadDocument,
  setMatchDocuments,
  toggleMergeCharge,
  mergeSelectedCharges,
}: Props): ReactElement => {
  const chargesData = readFragment(VatReportMiscTableFieldsFragmentDoc, data);
  const [isOpened, setIsOpened] = useState(true);

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <ActionIcon variant="default" onClick={(): void => setIsOpened(i => !i)} size={30}>
          {isOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
        </ActionIcon>
        Misc Charges (which are not on the above tables)
      </span>
      {isOpened && chargesData && (
        <AllChargesTable
          setEditChargeId={setEditCharge}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          setUploadDocument={setUploadDocument}
          data={chargesData.differentMonthDoc}
          isAllOpened={false}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={mergeSelectedCharges}
        />
      )}
    </>
  );
};
