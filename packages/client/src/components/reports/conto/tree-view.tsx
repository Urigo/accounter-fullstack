import React, { useCallback } from 'react';
import {
  getDescendants,
  Tree,
  type DragLayerMonitorProps,
  type NodeModel,
  type TreeProps,
} from '@minoru/react-dnd-treeview';
import type { ContoReportFiltersType } from './conto-report-filters.js';
import { CustomDragPreview } from './custom-drag-preview.js';
import { CustomNode } from './custom-node.js';
import { Placeholder } from './palceholder.js';
import type { CustomData } from './types.js';

type Props<T> = Pick<TreeProps<T>, 'tree' | 'onDrop' | 'rootId'> & {
  enableDnd: boolean;
  handleTextChange: (id: NodeModel['id'], value: string) => void;
  handleIsOpenChange: (id: NodeModel['id'], value: boolean) => void;
  handleDeleteCategory: (id: NodeModel['id']) => void;
  filter: ContoReportFiltersType;
};

export const TreeView: React.FC<Props<CustomData>> = ({
  tree,
  onDrop,
  rootId,
  handleIsOpenChange,
  handleTextChange,
  handleDeleteCategory,
  filter,
  enableDnd,
}) => (
  <Tree
    tree={tree}
    onDrop={onDrop}
    rootId={rootId}
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
          onToggle={() => {
            onToggle();
            handleIsOpenChange(node.id, !isOpen);
          }}
          onTextChange={handleTextChange}
          onDeleteCategory={handleDeleteCategory}
          descendants={getDescendants(tree, node.id)}
          filter={filter}
        />
      ),
      [tree, handleTextChange, handleDeleteCategory, handleIsOpenChange, filter],
    )}
    dragPreviewRender={useCallback(
      (monitorProps: DragLayerMonitorProps<CustomData>) => (
        <CustomDragPreview monitorProps={monitorProps} />
      ),
      [],
    )}
    sort={false}
    insertDroppableFirst={false}
    canDrag={() => enableDnd}
    canDrop={(_tree, { dragSource, dropTargetId }) => {
      if (!enableDnd) {
        return false;
      }
      if (dragSource?.parent === dropTargetId) {
        return true;
      }
      return void 0;
    }}
    dropTargetOffset={10}
    placeholderRender={(node, { depth }) => <Placeholder node={node} depth={depth} />}
    initialOpen={tree.filter(node => node.data?.isOpen).map(node => node.id)}
  />
);
