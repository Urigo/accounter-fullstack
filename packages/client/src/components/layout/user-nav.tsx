import { User2Icon } from 'lucide-react';
import { ArrowBigRightLines, FileDownload } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { CornJobsConfirmation, LogoutButton, PullDocumentsModal } from '../common/index.js';
import { Avatar } from '../ui/avatar.js';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';

export function UserNav(): JSX.Element {
  const [cornJobsOpened, { close: closeCornJobs, open: openCornJobs }] = useDisclosure(false);
  const [pullDocumentsOpened, { close: closePullDocuments, open: openPullDocuments }] =
    useDisclosure(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8 items-center flex flex-row justify-center">
              <User2Icon size={20} />
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">User Name</p>
              <p className="text-xs leading-none text-muted-foreground">Email</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Tooltip label="Pull Green Invoice Documents">
              <ActionIcon size={30} onClick={openPullDocuments}>
                <FileDownload size={20} />
              </ActionIcon>
            </Tooltip>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Tooltip label="Execute corn jobs">
              <ActionIcon size={30} onClick={openCornJobs}>
                <ArrowBigRightLines size={20} />
              </ActionIcon>
            </Tooltip>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LogoutButton />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CornJobsConfirmation close={closeCornJobs} opened={cornJobsOpened} />
      <PullDocumentsModal close={closePullDocuments} opened={pullDocumentsOpened} />
    </>
  );
}
