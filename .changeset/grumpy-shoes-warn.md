---
'@accounter/client': patch
---

- **Replaced Custom Tags Input**: The custom `TagsInput` component has been removed and replaced
  with a more generic `MultiSelect` component for tag selection within the charge edit form.
- **Standardized Form Field Handling**: Form fields for 'Tax Category Override', 'Business Trip',
  'Tags', and 'Charge Type' now consistently use `FormField` from `react-hook-form` along with
  `FormItem`, `FormLabel`, `FormControl`, and `FormMessage` components.
