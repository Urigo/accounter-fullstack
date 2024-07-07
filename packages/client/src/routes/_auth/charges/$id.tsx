import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/charges/$id')({
  component: () => <div>Hello /_auth/charges/$charge!</div>
})