import { Outlet, createFileRoute, redirect, useRouteContext } from '@tanstack/react-router'
import { DashboardLayout } from '../components/layout/dashboard-layout'

export const Route = createFileRoute('/_auth')({
    beforeLoad: ({ context }) => {
        const isLoggedIn = context.userServices.isLoggedIn()
        if (!isLoggedIn) {
            throw redirect({
                to: '/login'
            })
        }
    },
    component: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const test = useRouteContext({
            from: '/_auth'
        })
        return (
            <DashboardLayout filtersContext={test.filtersContext}>
                <Outlet />
            </DashboardLayout>
        )
    }
})