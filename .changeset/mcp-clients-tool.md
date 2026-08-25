---
'@accounter/server': minor
'@accounter/mcp-server': minor
---

Expose clients over the MCP connector.

Some businesses are also clients — they carry a `clients` row that adds contact emails, a default
document type, and a map of external-system ids. None of that reached the connector. The business
directory came back with no signal about which rows were clients, so an assistant could not tell a
supplier from a customer; and `accounter_get_contracts` had filtered by `clientIds` all along with
nothing on the connector able to enumerate them.

**A flag on the directory.** `accounter_list_businesses` rows now carry `isClient`, and the tool
takes an `isClient` filter. The filter is a real upstream predicate rather than a pass over the
returned page — `Query.allBusinesses` gained an `isClient` argument, applied ahead of the count and
the slice, so `pagination` and `totalCount` describe the filtered directory and no page comes back
short. That distinction matters more here than for `activeOnly`: clients are a small slice of the
directory, so filtering an already-sliced page would answer "the clients on page 1" while reading as
"the clients".

**A tool for the detail.** `accounter_list_clients` returns emails, the client-level default
document type, and the configured integrations, filtered by name or by `clientBusinessIds`. It is
separate from the directory rather than more fields on it because the directory is thousands of rows
against a hard payload cap, and hanging six integration ids off every row would spend that budget on
the majority that have none. It is also where any future client data belongs. Unconfigured
integrations are omitted rather than returned as `null`, and only `greenInvoiceInfo { greenInvoiceId }`
is selected — every other field on that type is fetched from the external Green Invoice API, one
request per client.

Client ids need no translation anywhere: a client's id **is** its business id, so the directory's
`id`, this tool's `businessId`, and the contracts filter's `clientIds` are one value.

**Four server-side fixes underneath.** All pre-existing, all in the path of reading a client:

- `ClientIntegrations` field resolvers parsed stored jsonb with a strict schema that threw on `NULL`
  and on any unknown key. Those resolvers run once per client, and the connector discards partial
  data whenever a response carries an `errors` entry — so one malformed row would have emptied an
  entire `allClients` call rather than degrading one record. Reading now goes through a lenient
  parser that treats `NULL` as unconfigured, strips unknown keys, and degrades a wrong-typed field to
  `null` without costing its siblings. Every one of the thirteen call sites was reading stored data,
  so all of them moved; the strict schema stays exported for a write path that wants it.
- `Client.generatedDocumentType` was declared non-null with no resolver — the column is
  `document_type`, so the default resolver returned `undefined` and any query selecting it errored.
  Nothing selected it, which is why the break was invisible.
- The same field was accepted by `insertClient`/`updateClient` and never written: neither statement
  touched `document_type`. It now persists.
- `Client` gained `ownerId`, which every connector row is required to carry.

Note that `generatedDocumentType` is the client-level default only. What actually gets issued is the
contract's own `documentType`, which `accounter_get_contracts` already returns.
