import React from 'react';
import { FileText, Folder } from 'lucide-react';

type Props = {
  droppable: boolean;
};

export const TypeIcon: React.FC<Props> = props => {
  if (props.droppable) {
    return <Folder />;
  }

  return <FileText />;
};
