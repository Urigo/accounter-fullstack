import { useState, type ReactElement } from 'react';
import { PanelTopClose, PanelTopOpen } from 'lucide-react';
import { VatReportMissingInfoFieldsFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { ChargesTable } from '../../charges/charges-table.js';
import { Button } from '../../ui/button.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VatReportMissingInfoFields on VatReportResult {
    missingInfo {
      id
      ...ChargesTableFields
    }
  }
`;

interface Props {
  data?: FragmentType<typeof VatReportMissingInfoFieldsFragmentDoc>;
  toggleMergeCharge: (chargeId: string) => void;
  mergeSelectedCharges: Set<string>;
}

export const MissingInfoTable = ({
  data,
  toggleMergeCharge,
  mergeSelectedCharges,
}: Props): ReactElement => {
  const chargesData = getFragmentData(VatReportMissingInfoFieldsFragmentDoc, data);
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
          {isOpened ? <PanelTopClose className="size-5" /> : <PanelTopOpen className="size-5" />}
        </Button>
        Missing Info
      </span>
      {isOpened && chargesData && (
        <ChargesTable
          data={chargesData.missingInfo}
          isAllOpened={false}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={mergeSelectedCharges}
        />
      )}
    </>
  );
};
