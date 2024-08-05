import { ChevronDownIcon, ChevronRightIcon, Tag } from 'lucide-react';
import { FragmentType, getFragmentData } from '../../gql';
import { AllTabsTableFieldsFragmentDoc } from '../../gql/graphql';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Fragment, useState } from 'react';
import { TagParent } from './cells/tag-parent';
import { TagName } from './cells/tag-name';
import { TagActionsModal } from './tag-actions-modal';
import { TagChildren } from './cells/tag-children';
import { PageLayout } from '../layout/page-layout';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllTabsTableFields on Tag {
    id
    name
    namePath
    parent {
        id
        name
    }
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
        <PageLayout
            title='Tags'
            description='Manage tags for your content'
        >
            <div className="border rounded-lg w-full">
                <Table>
                    <TableHeader>
                        <TableRow className='bg-gray-200'>
                            <TableHead className="w-[32px] font-semibold text-black sr-only">Expand</TableHead>
                            <TableHead className='font-semibold text-black'>Tag Name</TableHead>
                            <TableHead className='font-semibold text-black'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tags.map((tag, index) => (
                            <Fragment key={tag.id}>
                                <TableRow>
                                    <TableCell className="cursor-pointer" onClick={() => toggleRow(index)}>
                                        {expandedRows.includes(index) ? (
                                            <ChevronDownIcon className="w-6 h-6" />
                                        ) : (
                                            <ChevronRightIcon className="w-6 h-6" />
                                        )}
                                    </TableCell>
                                    <TagName data={tag} />
                                    <TableCell>
                                        <TagActionsModal refetch={refetch} tag={tag} />
                                    </TableCell>
                                </TableRow>
                                {expandedRows.includes(index) && (
                                    <TableRow>
                                        <TagParent data={tag} />
                                        <TagChildren expandedRows={expandedRows} data={tag} />
                                    </TableRow>
                                )}
                            </Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </PageLayout>
    );
}
