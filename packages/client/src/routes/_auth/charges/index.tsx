import { createFileRoute } from '@tanstack/react-router'
import { AllCharges } from '../../../components/all-charges'

export const Route = createFileRoute('/_auth/charges/')({
  component: () => <AllCharges />
})