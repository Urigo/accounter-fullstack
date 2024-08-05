import { ReactElement } from 'react';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { AllTagsParentFieldFragmentDoc } from '../../../gql/graphql.js';
import { TableCell, TableRow } from '../../ui/table.js';
import { Button } from '../../ui/button.js';
import { Badge } from '../../ui/badge.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllTagsParentField on Tag {
    parent {
     id
     name
     namePath
    }
  }
`;

type Props = {
    data: FragmentType<typeof AllTagsParentFieldFragmentDoc>;
    children?: ReactElement;
    onClick?: () => void;
};


export const TagParent = ({ data }: Props): ReactElement | null => {
    const tag = getFragmentData(AllTagsParentFieldFragmentDoc, data);
    return (
        tag.parent ? (
            <TableCell colSpan={5} className="px-20 py-4 bg-gray-200/50">
                <div className="grid gap-2">
                    <ul>
                        <li className='gap-3 flex'>
                            <span className="text-black font-semibold mr-3">Parent:</span>
                            <Badge>
                                {tag.parent.name}
                            </Badge>
                        </li>
                    </ul>
                </div>
            </TableCell>
        ) : null
    );
};


export function TagCell({ data, children, onClick }: Props): ReactElement {
    const tag = getFragmentData(AllTagsParentFieldFragmentDoc, data);

    return (
        <TableCell>
            {tag.parent && (
                <Button
                    onClick={() => onClick?.()}
                    className="flex items-center"
                    variant="link"
                >
                    {children}
                </Button>
            )}
        </TableCell>
    );
}