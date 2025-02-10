import React from 'react';
import { ArrowRight } from 'lucide-react';
import { NodeModel } from '@minoru/react-dnd-treeview';
import Typography from '@mui/material/Typography';
import { TypeIcon } from './type-icon.js';

type Props = {
  node: NodeModel;
  depth: number;
  isOpen: boolean;
  onToggle: (id: NodeModel['id']) => void;
};

export const CustomNode: React.FC<Props> = props => {
  const { droppable } = props.node;
  const indent = props.depth * 24;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onToggle(props.node.id);
  };

  return (
    <div
      className="tree-node items-center grid grid-cols-[auto_auto_1fr_auto] h-8 pe-2"
      style={{ paddingInlineStart: indent }}
    >
      <div
        className={`items-center text-[0] cursor-pointer flex h-6 justify-center w-6 ease-linear duration-100 ${props.isOpen ? 'rotate-90' : 'rotate-0'}`}
      >
        {props.node.droppable && (
          <button onClick={handleToggle}>
            <ArrowRight />
          </button>
        )}
      </div>
      <TypeIcon droppable={droppable || false} />
      <div className="ps-2">
        <Typography variant="body2">{props.node.text}</Typography>
      </div>
    </div>
  );
};
