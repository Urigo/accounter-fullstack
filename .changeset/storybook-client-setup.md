---
'@accounter/client': patch
---

Set up Storybook 10 (react-vite) for the client package, with initial stories for the Button UI
component and the All Charges screen. Stories are wrapped in the app's urql provider pointing at
`localhost:4000/graphql`, so GraphQL-backed components work against the mock server or a real
backend. Run it with `yarn workspace @accounter/client storybook`.
