import { useState, type ReactElement } from 'react';
import { PanelTopClose, PanelTopOpen } from 'lucide-react';
import { Card } from '@/components/ui/card.js';
import { VatReportMiscTableFieldsFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
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
  toggleMergeCharge: (chargeId: string) => void;
  mergeSelectedCharges: Set<string>;
};

export const MiscTable = ({
  data,
  toggleMergeCharge,
  mergeSelectedCharges,
}: Props): ReactElement => {
  const chargesData = getFragmentData(VatReportMiscTableFieldsFragmentDoc, data);
  const [isOpened, setIsOpened] = useState(true);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-7.5"
            onClick={(): void => setIsOpened(i => !i)}
            disabled={!chargesData || chargesData.differentMonthDoc.length === 0}
          >
            {isOpened ? <PanelTopClose className="size-5" /> : <PanelTopOpen className="size-5" />}
          </Button>
          Misc Charges (which are not on the above tables)
        </h2>
      </div>
      {isOpened && chargesData && (
        <ChargesTable
          data={chargesData.differentMonthDoc}
          isAllOpened={false}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={mergeSelectedCharges}
        />
      )}
    </Card>
  );
};
