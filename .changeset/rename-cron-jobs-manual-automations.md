---
'@accounter/client': patch
---

The "Cron Jobs" screen is renamed "Manual Automations", since nothing schedules these jobs: they
run only when triggered from the screen. The user-menu item, page title, breadcrumb and run button
follow the new name, the menu item gets a short tooltip describing what it does, and the route
moves from `/charges/cron-jobs` to `/charges/manual-automations`.
