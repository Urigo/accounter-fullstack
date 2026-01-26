---
'@accounter/client': patch
'@accounter/server': patch
---

- **GraphQL Schema Update**: The 'zip' field in the 'ClientInput' GraphQL type has been renamed to 'zipCode' for better clarity and consistency across the system.
- **Green Invoice Client Data Mapping**: The logic for converting local client data to Green Invoice client input has been updated to correctly use 'city' and 'zip_code' from local business data and to ensure all client details are sourced from the initial input, resolving potential data discrepancies.
- **UI Event Propagation Prevention**: The 'stopPropagation' method has been added to key UI elements in document generation and preview modals to prevent unintended click event bubbling, improving user interaction and preventing unexpected behavior.
- **UI Text Refinement**: A dialog title in the merge charges component has been updated from 'Issue New Document' to 'Merge Charges' for improved clarity and accuracy.
