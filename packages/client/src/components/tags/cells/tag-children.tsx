import { ReactElement } from 'react';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { AllTagsChildrenFieldFragmentDoc, AllTagsForEditModalDocument, Tag } from '../../../gql/graphql.js';
import { TableCell, TableRow } from '../../ui/table.js';
import { Badge } from '../../ui/badge.js';
import { useQuery } from 'urql';
import { Loader2 } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllTagsChildrenField on Tag {
    id
    name
    namePath
  }
`;

type Props = {
    data: FragmentType<typeof AllTagsChildrenFieldFragmentDoc>;
    children?: ReactElement;
    onClick?: () => void;
    expandedRows?: number[];
};

function indentStrings(strings: string[] | undefined | null): string[] {
    if (!strings || strings.length === 0) return [];
    if (strings.length === 1) return [];
    return strings.map((str: string, index: number) => '-'.repeat(index + 1) + ' ' + str);
}

export const TagChildren = ({ data, expandedRows }: Props): ReactElement | null => {
    const tagData = getFragmentData(AllTagsChildrenFieldFragmentDoc, data);
    const [{ data: allTags, fetching }] = useQuery({
        query: AllTagsForEditModalDocument,
        pause: expandedRows?.includes(tagData.id)
    });

    const childrenTags = allTags?.allTags.filter(tag =>
        tag.namePath?.includes(tagData.name)
    ).map(tag => ({
        name: tag.name
    })) ?? [];

    const indentedChildren = indentStrings(childrenTags.map(tag => tag.name));
    if (indentedChildren.length === 0) return null;

    return (
        tagData ? (
            <TableCell colSpan={5} className="px-20 py-4 bg-gray-200/50">
                {fetching ? <Loader2 className="w-6 h-6" /> : (
                    <div className="flex flex-row justify-start">
                        <span className="text-black font-semibold mr-3">Children:</span><div className='flex flex-col justify-start gap-3'>
                            {indentedChildren.map((tag, index) => (
                                <div key={index} className='text-sm'>
                                    <Badge>
                                        {tag}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </TableCell>) : null
    )
};

