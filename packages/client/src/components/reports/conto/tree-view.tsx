import React from 'react';
import { getDescendants, Tree, type NodeModel, type TreeProps } from '@minoru/react-dnd-treeview';
import { CustomDragPreview } from './custom-drag-preview.js';
import { CustomNode } from './custom-node.js';
import { Placeholder } from './palceholder.js';
import type { CustomData } from './types.js';

type Props<T> = Pick<TreeProps<T>, 'tree' | 'onDrop' | 'rootId'> & {
  enableDnd: boolean;
  handleTextChange: (id: NodeModel['id'], value: string) => void;
};

export const TreeView: React.FC<Props<CustomData>> = props => (
  <Tree
    tree={props.tree}
    onDrop={props.onDrop}
    rootId={props.rootId}
    classes={{
      root: 'box-border h-full p-8',
      draggingSource: 'opacity-30',
      placeholder: 'relative',
    }}
    render={(node, { depth, isOpen, onToggle }) => (
      <CustomNode
        node={node}
        depth={depth}
        isOpen={isOpen}
        onToggle={onToggle}
        onTextChange={props.handleTextChange}
        descendants={getDescendants(props.tree, node.id)}
      />
    )}
    dragPreviewRender={monitorProps => <CustomDragPreview monitorProps={monitorProps} />}
    sort={false}
    insertDroppableFirst={false}
    canDrag={() => props.enableDnd}
    canDrop={(_tree, { dragSource, dropTargetId }) => {
      if (!props.enableDnd) {
        return false;
      }
      if (dragSource?.parent === dropTargetId) {
        return true;
      }
      return;
    }}
    dropTargetOffset={10}
    placeholderRender={(node, { depth }) => <Placeholder node={node} depth={depth} />}
  />
);
