import { Stepper } from '@mantine/core';
import gql from 'graphql-tag';
import { useState } from 'react';

import { DocumentMatchFieldsFragment } from '../../__generated__/types';

// TODO: update fragment to use only relevant data
gql`
  fragment DocumentMatchFields on Document {
    __typename
    id
    image
    file
    ... on Proforma {
      vat {
        raw
        formatted
        currency
      }
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
    }
    ... on InvoiceReceipt {
      vat {
        raw
        formatted
        currency
      }
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
    }
    ... on Invoice {
      vat {
        raw
        formatted
        currency
      }
      serialNumber
      date
    }
    ... on Receipt {
      vat {
        raw
        formatted
        currency
      }
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
    }
  }
`;

interface Props {
  document: DocumentMatchFieldsFragment;
  skipDocument: () => void;
}

export function DocumentHandler({ document, skipDocument }: Props) {
  const [active, setActive] = useState(1);
  const nextStep = () => setActive(current => (current < 3 ? current + 1 : current));
  const prevStep = () => setActive(current => (current > 0 ? current - 1 : current));

  return (
    <>
      <Stepper active={active} onStepClick={setActive} breakpoint="sm">
        <Stepper.Step label="Supplement" description="Complete Missing Data">
          {/* update document form */}
        </Stepper.Step>
        <Stepper.Step label="Match" description="Select Matching Charge">
          {/* view best matches and select correct one */}
        </Stepper.Step>
        <Stepper.Step label="Confirm" description="Approve Match">
          {/* review and confirm selection */}
        </Stepper.Step>
        <Stepper.Completed>{/* completed view */}</Stepper.Completed>
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
