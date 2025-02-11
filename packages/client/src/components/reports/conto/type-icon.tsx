import React from 'react';
import { Folder, FolderOpen, IdCard } from 'lucide-react';

type Props = {
  droppable: boolean;
  open?: boolean;
};

export const TypeIcon: React.FC<Props> = props => {
  if (props.droppable) {
    if (props.open) {
      return <FolderOpen />;
    }
    return <Folder />;
  }

  return <IdCard />;
};
