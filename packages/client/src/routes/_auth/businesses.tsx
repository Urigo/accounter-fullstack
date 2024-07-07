import { createFileRoute } from '@tanstack/react-router'
import { Businesses } from '../../components/businesses'

export const Route = createFileRoute('/_auth/businesses')({
    component: () => <Businesses />
})