import { CSSProperties, useState } from 'react';
import { entitiesWithoutInvoice } from '../../../helpers';
import gql from 'graphql-tag';
import { InvoiceImageFieldsFragment } from '../../../__generated__/types';
import { PopUpModal } from '../../common/Modal';
import { Image } from '@mantine/core';
import { ButtonImage } from '../../common/ButtonImage';

gql`
  fragment InvoiceImageFields on Charge {
    invoice {
      ... on Document {
        id
        image
      }
    }
  }
`;

type Props = {
  data: InvoiceImageFieldsFragment;
  isBusiness: boolean;
  financialEntityName: string;
  style?: CSSProperties;
};

export const InvoiceImg = ({ data, isBusiness, financialEntityName, style }: Props) => {
  const image = data.invoice?.image;
  const [openedImage, setOpenedImage] = useState<string | null>(null);
  const indicator = isBusiness && !entitiesWithoutInvoice.includes(financialEntityName) && !image;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {image && (
        <>
          <ButtonImage onClick={() => setOpenedImage(image)}>
            <Image alt="" src={image} height={40} width={40} />
          </ButtonImage>
          <PopUpModal
            modalSize="45%"
            content={<Image alt="" src={image} />}
            opened={openedImage}
            onClose={() => setOpenedImage(null)}
          />
        </>
      )}
      {/* TODO: create update document hook */}
      {/* <UpdateButton transaction={transaction} propertyName="proforma_invoice_file" promptText="New Invoice Photo:" /> */}
    </td>
  );
};
