import { FC, PropsWithChildren } from 'react';
import { Divider } from '@mantine/core';

export interface ModalProps {
  my?: string;
  variant?: any;
}

export const AccounterDivider: FC<PropsWithChildren<ModalProps>> = ({ my, variant }) => {
  return (
    <>
      <Divider my={my} variant={variant} />
    </>
  );
};
