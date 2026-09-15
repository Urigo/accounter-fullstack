---
paths:
  - 'packages/client/src/components/**/*.tsx'
  - 'packages/client/src/components/**/*.ts'
---

# React Component Conventions

- Functional components with named exports and `ReactElement` return type.
- Import shadcn/ui components from relative `./ui/<component>.js` paths.
- Prefer core Tailwind utility classes (`h-64`, `p-4`) over arbitrary values (`h-[500px]`,
  `p-[15px]`).

## Forms

Use `react-hook-form` + `zod` + shadcn `Form`:

```tsx
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/form.js'
import { Input } from '../../components/ui/input.js'

const formSchema = z.object({ fieldName: z.string() })

export function FormComponent(): ReactElement {
  const form = useForm({ resolver: zodResolver(formSchema) })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="fieldName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label</FormLabel>
              <Input {...field} />
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
```

## Error & Loading States

Loading states use the animated Accounter abacus, from `../../components/ui/accounter-spinner.js`.
Both variants take the surrounding text colour and stand still under `prefers-reduced-motion`. Pick
by the shape of the slot:

- Wide and short — an overlay over a table, a full-width panel, a placeholder where a row of data is
  about to appear: `<AccounterBarSpinner />` (one rod, three beads, 10:3; keep any size override on
  that ratio).
- Roughly square — a whole route, a dialog, a card: `<AccounterSpinner />` (the full abacus, resized
  with `size-*`).
- Inline, inside a button or a table cell: `<Spinner />` from `../../components/ui/spinner.js` — the
  abacus is unreadable below ~40px.

Errors: `<Alert variant="destructive">` with `AlertTitle` and `AlertDescription` from
`../../components/ui/alert.js`.

## GraphQL Integration

- Queries: `const [{ data, fetching, error }] = useQuery({ query: YourQueryDocument })`.
- Mutations: wrap in a custom hook under `src/hooks/` (e.g. `useAcceptInvitation`). The hook handles
  `useMutation`, error handling via `handleCommonErrors`, and toast notifications (loading →
  success/error). Components consume the simplified `{ fetching, error, doAction }` return value —
  never call `useMutation` directly in a component.

## Dialogs

Use shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`,
`DialogTrigger` — all from `../components/ui/dialog.js`.

## Performance

- `useMemo` for expensive computations.
- `useCallback` for stable handler references passed as props.
