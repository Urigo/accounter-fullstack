import React, { useState } from 'react';
import { ArrowRight, Check, Pencil, X } from 'lucide-react';
import { NodeModel, useDragOver } from '@minoru/react-dnd-treeview';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { Input } from '../../ui/input.js';
import { TypeIcon } from './type-icon.js';
import { CustomData } from './types.js';

type Props = {
  node: NodeModel<CustomData>;
  depth: number;
  isOpen: boolean;
  onToggle: (id: NodeModel['id']) => void;
  onTextChange: (id: NodeModel['id'], value: string) => void;
};

export const CustomNode: React.FC<Props> = props => {
  const { id, text, droppable } = props.node;
  const [visibleInput, setVisibleInput] = useState(false);
  const [labelText, setLabelText] = useState(text);
  const indent = props.depth * 24;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onToggle(props.node.id);
  };

  const handleShowInput = () => {
    setVisibleInput(true);
  };

  const handleCancel = () => {
    setLabelText(text);
    setVisibleInput(false);
  };

  const handleChangeText = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLabelText(e.target.value);
  };

  const handleSubmit = () => {
    setVisibleInput(false);
    props.onTextChange(id, labelText);
  };

  const dragOverProps = useDragOver(id, props.isOpen, props.onToggle);

  return (
    <div
      className="tree-node items-center grid grid-cols-[auto_auto_1fr_auto] h-10 pe-2" // root
      style={{ paddingInlineStart: indent }}
      {...dragOverProps}
    >
      <div
        className={`items-center text-[0] flex h-6 justify-center w-6 ease-linear duration-100 ${props.isOpen ? 'rotate-90' : 'rotate-0'}`} // expandIconWrapper
      >
        {props.node.droppable && (
          <button className="cursor-pointer" onClick={handleToggle}>
            <ArrowRight />
          </button>
        )}
      </div>
      <TypeIcon droppable={droppable || false} />
      <div className="ps-2">
        {visibleInput ? (
          <div className="items-center grid grid-cols-[repeat(3,auto)] justify-start ">
            <Input className="text-sm py-2 w-48" value={labelText} onChange={handleChangeText} />
            <IconButton className="p-1" onClick={handleSubmit} disabled={labelText === ''}>
              <Check className="text-xl" />
            </IconButton>
            <IconButton className="p-1" onClick={handleCancel}>
              <X className="text-xl" />
            </IconButton>
          </div>
        ) : (
          <div className="items-center grid grid-cols-[repeat(3,auto)] justify-start ">
            <Typography variant="body2" className="pr-4">
              {props.node.text}
            </Typography>
            <IconButton className="p-1" onClick={handleShowInput}>
              <Pencil className="text-xl" />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
};
