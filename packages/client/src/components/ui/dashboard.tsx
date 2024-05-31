/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    BadgeDollarSign,
    Receipt,
    Tags,
    ReceiptText,
    BarChartBig,
    Scale,
    PlaneTakeoff,
    ArrowLeftRight,
    Files,
    Share,
    Handshake,
    BookOpenCheck,
} from 'lucide-react'


import { Button } from './button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { Icon } from '../common/icon'
import { ReactNode } from 'react'
import { Link, useResolvedPath } from 'react-router-dom'
import { CornJobsButton, FetchIncomeDocumentsButton, LogoutButton } from '../common'

const links = [
    {
        label: 'All Charges',
        to: '/charges',
        icon: <ReceiptText />,
    },
    {
        label: 'Ledger Validation',
        to: '/charges-ledger-validation',
        icon: <BookOpenCheck />,
    },
    {
        label: 'Documents',
        to: '/documents',
        icon: <Files />,
    },
    {
        label: 'Businesses',
        to: '/businesses',
        icon: <Handshake />,
    },
    {
        label: 'Business Transactions',
        to: '/business-transactions',
        icon: <ArrowLeftRight />,
    },
    {
        label: 'Business Trips',
        to: '/business-trips',
        icon: <PlaneTakeoff />,
    },
    {
        label: 'Trial Balance Report',
        to: '/reports/trial-balance',
        icon: <Scale />,
    },
    {
        label: 'VAT Monthly Report',
        to: '/reports/vat-monthly',
        icon: <Receipt />,
    },
    {
        label: 'Charts',
        to: '/charts',
        icon: <BarChartBig />
    },
    {
        label: 'Tags',
        to: '/tags',
        icon: <Tags />,
    },
    {
        label: 'Salaries',
        to: '/salaries',
        icon: <BadgeDollarSign />,
    },
];



// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const SideBarMenu = () => {
    return (
        <TooltipProvider>
            <nav className="grid gap-1 p-2">
                {links.map((link) => (
                    <Tooltip key={link.to}>
                        <TooltipTrigger asChild>
                            <Link to={link.to}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-lg"
                                    aria-label={link.label}
                                >
                                    {link.icon}
                                </Button>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={5}>
                            {link.label}
                        </TooltipContent>
                    </Tooltip>
                ))}
            </nav>
            <nav className="mt-auto grid gap-1 p-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <CornJobsButton />
                    </TooltipTrigger>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <FetchIncomeDocumentsButton />
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={5}>
                        Fetch Income Documents
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <LogoutButton />
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={5}>
                        Account
                    </TooltipContent>
                </Tooltip>
            </nav>
        </TooltipProvider>
    )
}

type DashboardProps = {
    children: ReactNode
    filters: ReactNode
}


export function Dashboard({ children, filters }: DashboardProps) {
    const resolvedPath = useResolvedPath({
        pathname: window.location.pathname,
    })
    const titleByPath = links.find((link) => link.to === resolvedPath.pathname)?.label


    return (
        <div className="grid h-screen w-full pl-[53px]">
            <aside className="inset-y fixed left-0 z-auto flex h-full flex-col border-r">
                <div className="border-b p-2">
                    <Button variant="outline" size="icon" aria-label="Home">
                        <Icon name="logo" />
                    </Button>
                </div>
                <SideBarMenu />
            </aside>
            <div className="flex flex-col">
                <header className="sticky top-0 justify-between z-10 flex h-[53px] items-center gap-1 border-b bg-background px-4">
                    <div className='flex flex-row justify-start gap-3'>
                        <h1 className="text-xl font-semibold">Accounter </h1>
                        <h1 className="text-xl"> | </h1>
                        <h1 className="text-xl">{titleByPath}</h1>
                    </div>
                    {filters}
                </header>
                <main className="grid flex-1 gap-4 overflow-auto p-4 md:grid-cols-2 lg:grid-cols-3">
                    {children}
                </main>
            </div>
        </div>
    )
}
