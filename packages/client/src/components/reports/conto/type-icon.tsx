import React from 'react';
import { Archive, IdCard } from 'lucide-react';

type Props = {
  droppable: boolean;
};

export const TypeIcon: React.FC<Props> = props => {
  if (props.droppable) {
    return <Archive />;
  }

  return <IdCard />;
};
