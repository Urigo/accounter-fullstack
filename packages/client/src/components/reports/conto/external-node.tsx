import React from 'react';
import { NodeModel } from '@minoru/react-dnd-treeview';
import Typography from '@mui/material/Typography';
import { TypeIcon } from './type-icon.js';

type Props = {
  node: NodeModel;
};

export const ExternalNode: React.FC<Props> = props => {
  const { droppable } = props.node;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text', JSON.stringify(props.node));
  };

  return (
    <div draggable className="items-center flex h-8" onDragStart={handleDragStart}>
      <div className="flex">
        <TypeIcon droppable={droppable || false} />
      </div>
      <div className="ps-2">
        <Typography variant="body2">{props.node.text}</Typography>
      </div>
    </div>
  );
};
