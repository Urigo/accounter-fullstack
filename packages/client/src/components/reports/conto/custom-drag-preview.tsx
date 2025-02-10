import React from 'react';
import { DragLayerMonitorProps } from '@minoru/react-dnd-treeview';
import { TypeIcon } from './type-icon.js';

type Props = {
  monitorProps: DragLayerMonitorProps<unknown>;
};

export const CustomDragPreview: React.FC<Props> = props => {
  const { item } = props.monitorProps;

  return (
    <div className="items-center bg-blue-600 rounded shadow-[0_12px_24px__-6px_rgba(0,0,0,0.25)_0_0_0_1px_rgba(0,0,0,0.08)] text-white text-sm inline-grid gap-[8px] py-1 px-2 pointer-events-none">
      <div className="items-center flex">
        <TypeIcon droppable={item.droppable || false} />
      </div>
      <div className="items-center flex">{item.text}</div>
    </div>
  );
};
