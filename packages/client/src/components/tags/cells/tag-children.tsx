import { ReactElement } from 'react';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { AllTagsChildrenFieldFragmentDoc } from '../../../gql/graphql.js';
import { TableCell, TableRow } from '../../ui/table.js';
import { Badge } from '../../ui/badge.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllTagsChildrenField on Tag {
    namePath
  }
`;

type Props = {
    data: FragmentType<typeof AllTagsChildrenFieldFragmentDoc>;
    children?: ReactElement;
    onClick?: () => void;
};

function indentStrings(strings: string[] | undefined | null): string[] {
    if (!strings || strings.length === 0) return [];
    if (strings.length === 1) return [];
    return strings.map((str: string, index: number) => index + 1 + ''.repeat(index + 1) + '. ' + str);
}

export const TagChildren = ({ data }: Props): ReactElement | null => {
    const tag = getFragmentData(AllTagsChildrenFieldFragmentDoc, data);
    const tagNamePath = indentStrings(tag.namePath);
    if (tagNamePath.length === 0) return null;

    return (
        <TableRow>
            <TableCell colSpan={5} className="px-20 py-4 bg-gray-200/50">
                <div className="flex flex-row justify-start">
                    <span className="text-black font-semibold mr-3">Children:</span>
                    <div className='flex flex-col justify-start gap-3'>
                        {tagNamePath.map((name, index) => (
                            <div key={index} className='text-sm'>
                                <Badge variant='outline'>
                                    {name}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </div>
            </TableCell>
        </TableRow>
    );
};

