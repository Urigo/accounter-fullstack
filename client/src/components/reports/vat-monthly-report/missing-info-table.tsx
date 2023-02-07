import { useState } from 'react';
import { ActionIcon } from '@mantine/core';
import { CaretDown, CaretUp } from 'tabler-icons-react';
import { FragmentType, getFragmentData } from '../../../gql';
import {
  EditChargeFieldsFragmentDoc,
  VarReportMissingInfoFieldsFragmentDoc,
} from '../../../gql/graphql';
import { AllChargesTable } from '../../all-charges/all-charges-table';

/* GraphQL */ `
  fragment VarReportMissingInfoFields on VatReportResult {
    missingInfo {
      id
      # ...ChargesFields
      ...AllChargesAccountFields
      ...AllChargesAccountantApprovalFields
      ...AllChargesAmountFields
      ...AllChargesDateFields
      ...AllChargesDescriptionFields
      ...AllChargesEntityFields
      ...AllChargesTagsFields
      ...AllChargesShareWithFields
      ...AllChargesVatFields
      ...EditChargeFields
      ...SuggestedCharge
      ...ChargeExtendedInfoFields

      # next are some fields for the temp columns:
      ledgerRecords {
        id
      }
      additionalDocuments {
        id
      }
      counterparty {
        name
      }
      ###
    }
}
`;

interface Props {
  data?: FragmentType<typeof VarReportMissingInfoFieldsFragmentDoc>;
}

export const MissingInfoTable = ({ data }: Props) => {
  const chargesData = getFragmentData(VarReportMissingInfoFieldsFragmentDoc, data);
  const [isOpened, setOpened] = useState(true);
  const [insertLedger, setInsertLedger] = useState<string | undefined>(undefined);
  const [insertDocument, setInsertDocument] = useState<string | undefined>(undefined);
  const [matchDocuments, setMatchDocuments] = useState<string | undefined>(undefined);
  const [uploadDocument, setUploadDocument] = useState<string | undefined>(undefined);
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  const [editCharge, setEditCharge] = useState<
    FragmentType<typeof EditChargeFieldsFragmentDoc> | undefined
  >(undefined);

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <ActionIcon variant="default" onClick={() => setOpened(i => !i)} size={30}>
          {isOpened ? <CaretUp size={20} /> : <CaretDown size={20} />}
        </ActionIcon>
        Missing Info
      </span>
      {isOpened && chargesData && (
        <AllChargesTable
          setEditCharge={setEditCharge}
          setInsertLedger={setInsertLedger}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          setUploadDocument={setUploadDocument}
          data={chargesData?.missingInfo}
          isAllOpened={isAllOpened}
        />
      )}
    </>
  );
};
