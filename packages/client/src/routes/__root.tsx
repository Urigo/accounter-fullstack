import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Providers } from '../providers'
import { UserService } from '../services/user-service'

type RootContext = {
    filtersContext: React.ReactElement | null
    setFiltersContext: (filtersContext: React.ReactElement | null) => void
    userServices: UserService
}

export const Route = createRootRouteWithContext<RootContext>()({
    component: () => (
        <Providers>
            <Outlet />
        </Providers>
    ),

})
