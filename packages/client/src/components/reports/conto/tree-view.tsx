import React, { useCallback } from 'react';
import {
  getDescendants,
  Tree,
  type DragLayerMonitorProps,
  type NodeModel,
  type TreeProps,
} from '@minoru/react-dnd-treeview';
import { CustomDragPreview } from './custom-drag-preview.js';
import { CustomNode } from './custom-node.js';
import { Placeholder } from './palceholder.js';
import type { CustomData } from './types.js';

type Props<T> = Pick<TreeProps<T>, 'tree' | 'onDrop' | 'rootId'> & {
  enableDnd: boolean;
  handleTextChange: (id: NodeModel['id'], value: string) => void;
  handleDeleteCategory: (id: NodeModel['id']) => void;
};

export const TreeView: React.FC<Props<CustomData>> = props => (
  <Tree
    tree={props.tree}
    onDrop={props.onDrop}
    rootId={props.rootId}
    classes={{
      root: 'box-border h-full p-4',
      draggingSource: 'opacity-30',
      placeholder: 'relative',
    }}
    render={useCallback(
      (node: NodeModel<CustomData>, { depth, isOpen, onToggle }) => (
        <CustomNode
          node={node}
          depth={depth}
          isOpen={isOpen}
          onToggle={onToggle}
          onTextChange={props.handleTextChange}
          onDeleteCategory={props.handleDeleteCategory}
          descendants={getDescendants(props.tree, node.id)}
        />
      ),
      [props.tree, props.handleTextChange, props.handleDeleteCategory],
    )}
    dragPreviewRender={useCallback(
      (monitorProps: DragLayerMonitorProps<CustomData>) => (
        <CustomDragPreview monitorProps={monitorProps} />
      ),
      [],
    )}
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
      return void 0;
    }}
    dropTargetOffset={10}
    placeholderRender={(node, { depth }) => <Placeholder node={node} depth={depth} />}
  />
);
