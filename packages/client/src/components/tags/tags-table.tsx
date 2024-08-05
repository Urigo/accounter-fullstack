import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { FragmentType, getFragmentData } from '../../gql';
import { AllTabsTableFieldsFragmentDoc } from '../../gql/graphql';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Fragment, useState } from 'react';
import { TagCell, TagParent } from './cells/parent';
import { TagName } from './cells/name';
import { TagActionsModal } from './tag-actions-modal';
import { TagChildren } from './cells/tag-children';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllTabsTableFields on Tag {
    id
    name
    namePath
    ...AllTagsNameField
    ...AllTagsParentField
    ...AllTagsChildrenField
  }
`;

type TagsTableProps = {
    data?: FragmentType<typeof AllTabsTableFieldsFragmentDoc>[];
    refetch: () => void;
};

export function TagsTable({ data, refetch }: TagsTableProps): JSX.Element {
    const tags = data?.map(tag => getFragmentData(AllTabsTableFieldsFragmentDoc, tag)) ?? [];
    const [expandedRows, setExpandedRows] = useState<number[]>([]);

    function toggleRow(index: number): void {
        setExpandedRows(prevState =>
            prevState.includes(index) ? prevState.filter(row => row !== index) : [...prevState, index]
        );
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle className='text-[24px]'>Tags</CardTitle>
                <CardDescription>Manage tags for your bookmarks.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg w-full">
                    <Table>
                        <TableHeader>
                            <TableRow className='bg-gray-200'>
                                <TableHead className="w-[32px] font-semibold text-black">
                                    <span className="sr-only">Expand</span>
                                </TableHead>
                                <TableHead className='font-semibold text-black'>Tag Name</TableHead>
                                <TableHead className='font-semibold text-black'>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tags.map((tag, index) => (
                                <Fragment key={tag.id}>
                                    <TableRow>
                                        <TableCell className="cursor-pointer" onClick={() => toggleRow(index)}>
                                            {expandedRows.includes(index) ? <ChevronDownIcon size={24} /> : <ChevronRightIcon size={24} />}
                                        </TableCell>
                                        <TagName data={tag} />
                                        <TableCell>
                                            <TagActionsModal refetch={refetch} tag={tag} />
                                        </TableCell>
                                    </TableRow>
                                    {expandedRows.includes(index) && (
                                        <>
                                            <TagChildren data={tag} />
                                            <TagParent data={tag} />
                                        </>
                                    )}
                                </Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
