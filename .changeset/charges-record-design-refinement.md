---
'@accounter/client': patch
---

Adopt the imported charges-list design refinement: per-type colour chips, a selection accent rail,
one unified card, an anchored expansion panel, and a real drop-target state.

**Per-type colour chip.** `CHARGE_TYPE_COLOR` in `helpers/charges.tsx` gives each of the eleven
charge types its own hue, rendered by `ChargeTypeBadge` as a tinted, ringed icon chip beside the type
name. Colour is what lets you pick every Salary charge out of a hundred rows without reading, which a
uniformly grey icon could not do.

Three of the designer's hues were reassigned because they collided with the status vocabulary the
record already uses — amber means "needs attention", emerald "accept / positive amount", red
"error / negative amount", and all three appear on the same row as the chip. Salary moved amber →
purple, Monthly VAT emerald → sky, Dividend rose → pink; the other eight are unchanged. A test
asserts the reservation, so a future palette edit cannot quietly put a status colour back on a type.
The hue class lists are complete literal strings rather than interpolated from the hue name, since
Tailwind only ever sees literals in source.

**Selection and drop feedback.** A selected record now carries a 2px left accent rail in addition to
its background tint. `DragFile` names its dropzone group so the record can style itself off Mantine's
`data-accept`, lighting the whole row on drag — previously the only sign a drag had registered was the
cursor, over a target with no visible edges. The drop ring is `primary`, not the `ring` token:
`--color-accent` and `--color-muted` hold the same value, so the tint alone was indistinguishable from
the selected background, and a grey ring at 40% did not separate them either.

**One surface.** Toolbar and record list now share a single bordered, rounded card instead of the
toolbar floating above a separately bordered list; its select-all checkbox in particular looked
disconnected from the rows it governs. The expansion panel is indented under its record behind a rail,
so it reads as belonging to that charge rather than as the next item in the list.

**Smaller fixes carried from the same design pass.** The CSV export gains a visible label — icon-only,
it had no accessible name at all, since a tooltip is a description rather than a name. Count chips gain
hover hints naming what they count and what is wrong when something is. "Delete Charge" is finally
styled destructive; it was the only irreversible item in the menu and sat in the same weight as "Copy
Charge Link" directly above it. The accountant-status control gains a section label, a dot and a
current-value checkmark per option, an `aria-label` on its trigger (it previously offered a hundred
identically unnamed buttons down a list), a note that Pending means a *downgrade* rather than a step
toward approval, and `dark:` variants it had none of — the VAT and business-trip reports share this
control and inherit all of it.

Charges-surface neutrals now use the colour tokens activated in the previous release; the amber,
emerald, red status accents and the eleven type hues stay literal, since no token expresses them. The
duplicated "absent value" placeholder, defined identically in two files, is now one shared component.

Two things in the imported mockup were deliberately **not** adopted, because the shipped code is
better: `role="status"` on the needs badge (a hundred rows would mean a hundred live regions
announcing on every refetch) and a count chip whose state never reaches its accessible name. Its
compact row also dropped the approval control and the date and reflowed the column spans; approval is
the primary triage action and the date the second-most-scanned field, and holding spans stable across
densities means toggling density does not reflow the columns.
