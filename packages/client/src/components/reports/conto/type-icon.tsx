import React from 'react';
import { Folder, FolderOpen, IdCard } from 'lucide-react';

type Props = {
  droppable: boolean;
  open?: boolean;
};

export const TypeIcon: React.FC<Props> = props => {
  if (props.droppable) {
    if (props.open) {
      return <FolderOpen size={30} />;
    }
    return <Folder size={30} />;
  }

  return <IdCard />;
};
