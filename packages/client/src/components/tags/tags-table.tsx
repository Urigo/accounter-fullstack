import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { FragmentType, getFragmentData } from '../../gql';
import { AllTabsTableFieldsFragmentDoc } from '../../gql/graphql';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Fragment, useState } from 'react';
import { sortTags } from '../../helpers';
import { TagCell, TagParent } from './cells/parent';
import { TagName } from './cells/name';
import { TagActionsModal } from './tag-actions-modal';
import { TagChildren } from './cells/tag-children';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllTabsTableFields on Tag {
      id
      name
        ...AllTagsNameField
        ...AllTagsParentField
        ...AllTagsChildrenField
  }
`;

type TagsTableProps = {
    data?: FragmentType<typeof AllTabsTableFieldsFragmentDoc>[];
}


export function TagsTable({ data }: TagsTableProps): JSX.Element {
    const tags = data?.map(charge => getFragmentData(AllTabsTableFieldsFragmentDoc, charge)) ?? [];
    const allTagsSorted = sortTags(tags);


    const [expandedRows, setExpandedRows] = useState([] as number[]);
    const toggleRowExpansion = (index: number): void => {
        if (allTagsSorted[index]) {

            setExpandedRows(prev => {
                if (prev.includes(index)) {
                    return prev.filter(i => i !== index);
                }
                return [...prev, index];
            });
        }
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle className='text-[24px]'>Tags</CardTitle>
                <CardDescription>
                    Manage tags for your bookmarks.
                </CardDescription>
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
                            {allTagsSorted.map((tag, index) => (
                                <Fragment key={tag.id}>
                                    <TableRow>
                                        <TagCell data={tag} onClick={() => toggleRowExpansion(index)}>
                                            {expandedRows.includes(index) ? <ChevronDownIcon /> : <ChevronRightIcon />}
                                        </TagCell>
                                        <TagName data={tag} />
                                        <TableCell>
                                            <TagActionsModal tag={tag} />
                                        </TableCell>
                                    </TableRow>
                                    {expandedRows.includes(index) && (
                                        <>
                                            <TagParent data={tag} />
                                            <TagChildren data={tag} />
                                        </>
                                    )}
                                </Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card >
    );
}