---
'@accounter/client': patch
'@accounter/server': patch
---

- **Authentication Component Renaming**: Renamed core authentication files and classes, including
  `AuthContextV2Provider` to `AuthContextProvider` and `authPluginV2` to `authPlugin`, removing the
  'V2' suffix to signify their stable status.
