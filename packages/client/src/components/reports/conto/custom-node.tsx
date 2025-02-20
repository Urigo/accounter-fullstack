import React, { useState } from 'react';
import {
  Check,
  Ellipsis,
  PanelTopCloseIcon,
  PanelTopOpenIcon,
  Pencil,
  Trash,
  X,
} from 'lucide-react';
import { ActionIcon } from '@mantine/core';
import { NodeModel, useDragOver } from '@minoru/react-dnd-treeview';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { BusinessExtendedInfo } from '../../business-transactions/business-extended-info.js';
import { Badge } from '../../ui/badge.js';
import { Button } from '../../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu.js';
import { Input } from '../../ui/input.js';
import { ContentTooltip } from '../../ui/tooltip.js';
import type { ContoReportFiltersType } from './conto-report-filters.js';
import { TypeIcon } from './type-icon.js';
import { CustomData } from './types.js';

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'ILS',
  trailingZeroDisplay: 'stripIfInteger',
});

type Props = {
  node: NodeModel<CustomData>;
  depth: number;
  isOpen: boolean;
  onToggle: (id: NodeModel['id']) => void;
  onTextChange: (id: NodeModel['id'], value: string) => void;
  onDeleteCategory: (id: NodeModel['id']) => void;
  descendants: NodeModel<CustomData>[];
  filter: ContoReportFiltersType;
};

export const CustomNode: React.FC<Props> = props => {
  const { id, text, droppable } = props.node;
  const [visibleInput, setVisibleInput] = useState(false);
  const [labelText, setLabelText] = useState(text);
  const [toggleLedger, setToggleLedger] = useState(true);
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

  const isCategory = droppable && !props.node.data?.sortCode;

  return (
    <>
      <div
        className="items-center grid grid-cols-[auto_auto_1fr_auto] h-10 pe-2" // root
        style={{ paddingInlineStart: indent }}
        {...dragOverProps}
      >
        {props.node.droppable ? (
          <button className="cursor-pointer" onClick={handleToggle}>
            <TypeIcon droppable={droppable || false} open={props.isOpen} />
            {!props.isOpen && (
              <div className="relative -top-5 font-bold text-xs">
                {props.descendants.filter(d => !d.droppable).length}
              </div>
            )}
          </button>
        ) : (
          <TypeIcon droppable={droppable || false} open={props.isOpen} />
        )}
        <div className="ps-2">
          {visibleInput && isCategory ? (
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
            <div className="items-center grid grid-cols-[repeat(4,auto)] justify-start">
              <Typography variant="body2" className="pr-2">
                {props.node.text}
              </Typography>
              {props.node.data?.sortCode && (
                <Badge variant="outline">Sort Code {props.node.data?.sortCode}</Badge>
              )}
              <Badge>
                {formatter.format(
                  props.node.data?.value == null
                    ? props.descendants
                        .filter(d => !d.droppable)
                        .reduce((partialSum, d) => partialSum + (d.data?.value ?? 0), 0)
                    : props.node.data.value,
                )}
              </Badge>
              {isCategory && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-1">
                      <Ellipsis size={20} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={handleShowInput}>
                        Edit Category
                        <DropdownMenuShortcut>
                          <Pencil size={15} />
                        </DropdownMenuShortcut>
                      </DropdownMenuItem>
                      {isCategory && (
                        <DropdownMenuItem onClick={() => props.onDeleteCategory(id)}>
                          Delete Category
                          <DropdownMenuShortcut>
                            <Trash size={15} color="red" />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuGroup>
                    {/* <DropdownMenuSeparator /> */}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {!droppable && (
                <div className="pl-2">
                  <ContentTooltip content="Expand records">
                    <ActionIcon
                      variant="default"
                      onClick={(): void => setToggleLedger(i => !i)}
                      size={30}
                    >
                      {toggleLedger ? (
                        <PanelTopCloseIcon size={20} />
                      ) : (
                        <PanelTopOpenIcon size={20} />
                      )}
                    </ActionIcon>
                  </ContentTooltip>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {!droppable && toggleLedger && (
        <div>
          <BusinessExtendedInfo businessID={props.node.id as string} filter={props.filter} />
        </div>
      )}
    </>
  );
};
