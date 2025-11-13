---
'@accounter/client': patch
'@accounter/server': patch
---

- **New Annual Revenue Report**: A new report screen has been added to display annual revenue data,
  categorized by country and client.
- **Interactive User Interface**: The report features an interactive user interface allowing users
  to expand and collapse country and client details to view underlying transactions.
- **Data Filtering and Export**: Users can filter the report by year using a dedicated year picker
  and export the displayed data into a CSV format.
- **GraphQL API Integration**: New GraphQL types and a query have been introduced on the server-side
  to fetch the structured annual revenue data.
- **Navigation Integration**: The new Annual Revenue Report is now accessible via a new entry in the
  application's sidebar navigation.
