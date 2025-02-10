import React, { useState } from 'react';
import { CirclePlus } from 'lucide-react';
import { DndProvider } from 'react-dnd';
import { NativeTypes } from 'react-dnd-html5-backend';
import { getBackendOptions, MultiBackend, Tree } from '@minoru/react-dnd-treeview';
import type { DropOptions, NodeModel } from '@minoru/react-dnd-treeview';
import { Button } from '../../ui/button.js';
import { CustomDragPreview } from './custom-drag-preview.js';
import { CustomNode } from './custom-node.js';
import { ExternalNode } from './external-node.js';

const sampleData: NodeModel<object>[] = [
  {
    id: 1,
    parent: 0,
    droppable: true,
    text: 'Folder 1',
  },
  {
    id: 2,
    parent: 1,
    droppable: false,
    text: 'File 1-1',
  },
  {
    id: 3,
    parent: 1,
    droppable: false,
    text: 'File 1-2',
  },
  {
    id: 4,
    parent: 0,
    droppable: true,
    text: 'Folder 2',
  },
  {
    id: 5,
    parent: 4,
    droppable: true,
    text: 'Folder 2-1',
  },
  {
    id: 6,
    parent: 5,
    droppable: false,
    text: 'File 2-1-1',
  },
  {
    id: 7,
    parent: 0,
    droppable: false,
    text: 'File 3',
  },
];

const externalNodesData: NodeModel<object>[] = [
  {
    id: 101,
    parent: 0,
    text: 'External node 1',
  },
  {
    id: 102,
    parent: 0,
    text: 'External node 2',
  },
  {
    id: 103,
    parent: 0,
    text: 'External node 3',
  },
  {
    id: 104,
    parent: 0,
    text: 'External node 4',
  },
];

export const ContoReport: React.FC = () => {
  const [tree, setTree] = useState(sampleData);
  const [externalNodes, setExternalNodes] = useState(externalNodesData);
  const [lastId, setLastId] = useState(105);

  const handleDrop = (newTree: NodeModel<object>[], options: DropOptions) => {
    const { dropTargetId, monitor } = options;
    const itemType = monitor.getItemType();

    if (itemType === NativeTypes.TEXT) {
      const nodeJson = monitor.getItem().text;
      const node = JSON.parse(nodeJson);

      node.parent = dropTargetId;
      setTree([...newTree, node]);
      setExternalNodes(externalNodes.filter(exnode => exnode.id !== node.id));
      return;
    }

    setTree(newTree);
  };

  const handleAddExternalNode = () => {
    const node: NodeModel<object> = {
      id: lastId,
      parent: 0,
      text: `External node ${lastId - 100}`,
    };

    setExternalNodes([...externalNodes, node]);
    setLastId(lastId + 1);
  };

  return (
    <div className="grid h-full grid-cols-[auto_1fr]">
      <div className="border-r border-solid corder-color-zinc-100 grid grid-rows-[64px_1fr] p-8 relative">
        <div>
          <Button variant="outline" onClick={handleAddExternalNode} className="gap-2">
            <CirclePlus />
            Add node
          </Button>
        </div>
        <div>
          {externalNodes.map(node => (
            <ExternalNode key={node.id} node={node} />
          ))}
        </div>
      </div>
      <div>
        <DndProvider backend={MultiBackend} options={getBackendOptions()} debugMode>
          <Tree
            rootId={0}
            tree={tree}
            extraAcceptTypes={[NativeTypes.TEXT]}
            classes={{
              root: 'box-border h-full pt-24 pi-8 pb-8',
              draggingSource: 'opacity-o.3',
              dropTarget: 'bg-indigo-100',
            }}
            render={(node, options) => <CustomNode node={node} {...options} />}
            dragPreviewRender={monitorProps => <CustomDragPreview monitorProps={monitorProps} />}
            onDrop={handleDrop}
          />
        </DndProvider>
      </div>
    </div>
  );
};
