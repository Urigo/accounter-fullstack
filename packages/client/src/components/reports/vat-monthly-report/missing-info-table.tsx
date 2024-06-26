import { Dispatch, ReactElement, SetStateAction, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import {
  AllChargesTable,
  AllChargesTableFieldsFragmentDoc,
} from '../../all-charges/all-charges-table.js';

export const VatReportMissingInfoFieldsFragmentDoc = graphql(
  `
    fragment VatReportMissingInfoFields on VatReportResult {
      missingInfo {
        id
        ...AllChargesTableFields
      }
    }
  `,
  [AllChargesTableFieldsFragmentDoc],
);

interface Props {
  data?: FragmentOf<typeof VatReportMissingInfoFieldsFragmentDoc>;
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
}

export const MissingInfoTable = ({
  data,
  setEditCharge,
  setInsertDocument,
  setUploadDocument,
  setMatchDocuments,
  toggleMergeCharge,
  mergeSelectedCharges,
}: Props): ReactElement => {
  const chargesData = readFragment(VatReportMissingInfoFieldsFragmentDoc, data);
  const [isOpened, setIsOpened] = useState(true);

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <ActionIcon variant="default" onClick={(): void => setIsOpened(i => !i)} size={30}>
          {isOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
        </ActionIcon>
        Missing Info
      </span>
      {isOpened && chargesData && (
        <AllChargesTable
          setEditChargeId={setEditCharge}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          setUploadDocument={setUploadDocument}
          data={chargesData.missingInfo}
          isAllOpened={false}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={mergeSelectedCharges}
        />
      )}
    </>
  );
};
