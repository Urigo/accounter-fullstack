import { Stepper } from '@mantine/core';
import gql from 'graphql-tag';
import { useEffect, useState } from 'react';

import { DocumentHandlerFieldsFragment, DocumentMatchChargesFieldsFragment } from '../../__generated__/types';
import { EditDocument } from '../all-charges/documents/edit-document';
import { DocumentMatchCompleted } from './document-match-completed';
import { DocumentMatchesSelection } from './document-matches-selection';

function EditStep({
  document,
  setReadyForNextStep,
}: Pick<Props, 'document'> & { setReadyForNextStep: (ready: boolean) => void }) {
  setReadyForNextStep(true);
  return <EditDocument documentData={document} />;
}

gql`
  fragment DocumentHandlerFields on Document {
    id
    isReviewed
    ...EditDocumentFields
    ...DocumentMatchFields
  }
`;

interface Props {
  document: DocumentHandlerFieldsFragment;
  charges: DocumentMatchChargesFieldsFragment['financialEntity']['charges']['nodes'];
  skipDocument: () => void;
}

export function DocumentHandler({ document, charges, skipDocument }: Props) {
  const firstStep = document.isReviewed ? 1 : 0;

  const [active, setActive] = useState(firstStep);
  const [readyForNextStep, setReadyForNextStep] = useState(false);
  const [selectedChargeId, setSelectedChargeId] = useState<string | null>(null);
  const nextStep = () => {
    setReadyForNextStep(false);
    setActive(current => (current < 3 ? current + 1 : current));
  };
  const prevStep = () => setActive(current => (current > 0 ? current - 1 : current));

  // force EditStep rerender on document switch
  useEffect(() => {
    setActive(-1);
    setTimeout(() => {
      setActive(firstStep);
    }, 1);
  }, [document.id]);

  return (
    <>
      <Stepper active={active} onStepClick={setActive} breakpoint="sm">
        <Stepper.Step label="Supplement" description="Complete Missing Data">
          {active === 0 && <EditStep document={document} setReadyForNextStep={setReadyForNextStep} />}
        </Stepper.Step>
        <Stepper.Step label="Match" description="Select Matching Charge">
          <DocumentMatchesSelection
            setReadyForNextStep={setReadyForNextStep}
            document={document}
            charges={charges}
            setSelectedChargeId={setSelectedChargeId}
          />
        </Stepper.Step>
        {/* <Stepper.Step label="Confirm" description="Approve Match">
          review and confirm selection
        </Stepper.Step> */}
        <Stepper.Completed>
          {selectedChargeId ? (
            <DocumentMatchCompleted documentId={document.id} chargeId={selectedChargeId} />
          ) : (
            <p>We had error executing this match :(</p>
          )}
        </Stepper.Completed>
      </Stepper>
      <div className="flex flex-col sm:flex-row sm:justify-center lg:justify-start gap-2.5">
        <button
          onClick={prevStep}
          className="inline-block bg-gray-200 hover:bg-gray-300 focus-visible:ring ring-indigo-300 text-gray-500 active:text-gray-700 text-sm md:text-base font-semibold text-center rounded-lg outline-none transition duration-100 px-8 py-3"
        >
          Back
        </button>
        <button
          onClick={nextStep}
          className="inline-block bg-indigo-500 hover:bg-indigo-600 focus-visible:ring ring-indigo-300 text-white active:bg-indigo-700 text-sm md:text-base font-semibold text-center rounded-lg outline-none transition duration-100 px-8 py-3"
          disabled={!readyForNextStep}
        >
          Next step
        </button>
        <button
          onClick={skipDocument}
          className="inline-block bg-red-500 hover:bg-red-600 active:bg-red-700 focus-visible:ring ring-indigo-300 text-white text-sm md:text-base font-semibold text-center rounded-lg outline-none transition duration-100 px-8 py-3"
        >
          Skip Document
        </button>
      </div>
    </>
  );
}
