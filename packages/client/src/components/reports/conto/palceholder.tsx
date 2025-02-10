import React from 'react';
import { NodeModel } from '@minoru/react-dnd-treeview';

type Props = {
  node: NodeModel;
  depth: number;
};

export const Placeholder: React.FC<Props> = props => {
  const left = props.depth * 24;
  return (
    <div className="bg-[#1967d2] h-0.5 absolute -translate-y-2/4 right-0 top-0" style={{ left }}>
      {/* empty */}
    </div>
  );
};
