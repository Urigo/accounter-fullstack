---
'@accounter/client': patch
---

Fix charges filter fields re-rendering the values they were just cleared of.

Reported against the entities section: apply a filter with one or more financial entities, reopen
the modal, remove every selected entity — and the picker repopulates with the entities that were
just removed. Applying from there filtered *without* them, so the form was showing one thing and
submitting another.

`FormField` is shadcn's wrapper around react-hook-form's `Controller`, which resolves the rendered
value as `get(_formValues, name, X)`, where `X` is the value the field held when it mounted and
`get` falls back to `X` whenever the stored value is `undefined`. Every field in this modal clears
itself to exactly that `undefined` — an empty array is not "unset": `JSON.stringify` keeps `[]`, so
it would churn the URL and light up the trigger badge. Clearing a field therefore re-armed the
fallback and re-rendered the value the modal opened with, while the form state — and so the applied
filter — correctly held nothing. It only bit on a second visit, because on a first visit the
mount-time value is empty too.

The displayed value now comes from a new `useFilterValue` — `useWatch` with no `defaultValue`,
which carries no such fallback — rather than from the controller. The form's `undefined`
representation is unchanged, so `formValuesToFilter`, the active-filter counts and the URL encoding
are untouched.

The same fallback sat under every other field in the modal, all fixed here: financial accounts,
tags, owners, business trips, charge types, accountant status, the two free-text inputs, both dates
and the nine completeness switches. It also defeated **Reset** and **Clear all**, which call
`form.reset()` and so write the same `undefined` — any field holding a value when the modal opened
kept displaying it after the reset.
