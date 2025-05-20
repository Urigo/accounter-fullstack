import { Dispatch, ReactElement, SetStateAction, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { VatReportMiscTableFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { ChargesTable } from '../../charges/charges-table.js';
import { Button } from '../../ui/button.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VatReportMiscTableFields on VatReportResult {
    differentMonthDoc {
      id
      ...ChargesTableFields
    }
  }
`;

type Props = {
  data?: FragmentType<typeof VatReportMiscTableFieldsFragmentDoc>;
  setEditCharge: Dispatch<SetStateAction<{ id: string; onChange: () => void } | undefined>>;
  setInsertDocument: React.Dispatch<
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
  setMatchDocuments,
  toggleMergeCharge,
  mergeSelectedCharges,
}: Props): ReactElement => {
  const chargesData = getFragmentData(VatReportMiscTableFieldsFragmentDoc, data);
  const [isOpened, setIsOpened] = useState(true);

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={(): void => setIsOpened(i => !i)}
        >
          {isOpened ? (
            <LayoutNavbarCollapse className="size-5" />
          ) : (
            <LayoutNavbarExpand className="size-5" />
          )}
        </Button>
        Misc Charges (which are not on the above tables)
      </span>
      {isOpened && chargesData && (
        <ChargesTable
          setEditChargeId={setEditCharge}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          data={chargesData.differentMonthDoc}
          isAllOpened={false}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={mergeSelectedCharges}
        />
      )}
    </>
  );
};
