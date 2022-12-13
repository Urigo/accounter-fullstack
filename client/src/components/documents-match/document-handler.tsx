import { useEffect, useState } from 'react';
import { Stepper } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../gql';
import {
  DocumentHandlerFieldsFragmentDoc,
  DocumentMatchChargesFieldsFragmentDoc,
  EditDocumentFieldsFragmentDoc,
} from '../../gql/graphql';
import { EditDocument } from '../all-charges/documents/edit-document';
import { DocumentMatchCompleted } from './document-match-completed';
import { DocumentMatchesSelection } from './document-matches-selection';

function EditStep({
  documentProps,
  setReadyForNextStep,
}: Pick<Props, 'documentProps'> & { setReadyForNextStep: (ready: boolean) => void }) {
  setReadyForNextStep(true);
  return (
    <EditDocument
      documentProps={documentProps as FragmentType<typeof EditDocumentFieldsFragmentDoc>}
    />
  );
}

/* GraphQL */ `
  fragment DocumentHandlerFields on Document {
    id
    isReviewed
    ...EditDocumentFields
    ...DocumentMatchFields
  }
`;

interface Props {
  documentProps: FragmentType<typeof DocumentHandlerFieldsFragmentDoc>;
  chargesProps?: FragmentType<typeof DocumentMatchChargesFieldsFragmentDoc>;
  skipDocument: () => void;
}

export function DocumentHandler({ documentProps, chargesProps, skipDocument }: Props) {
  const document = getFragmentData(DocumentHandlerFieldsFragmentDoc, documentProps);
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
  }, [document.id, firstStep]);

  return (
    <>
      <Stepper active={active} onStepClick={setActive} breakpoint="sm">
        <Stepper.Step label="Supplement" description="Complete Missing Data">
          {active === 0 && (
            <EditStep documentProps={documentProps} setReadyForNextStep={setReadyForNextStep} />
          )}
        </Stepper.Step>
        <Stepper.Step label="Match" description="Select Matching Charge">
          <DocumentMatchesSelection
            setReadyForNextStep={setReadyForNextStep}
            documentProps={document}
            chargesProps={chargesProps}
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
