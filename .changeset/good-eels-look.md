---
'@accounter/client': patch
'@accounter/server': patch
---

- **Email Sending Control**: I've added a new sendEmail option to the document issuing flow, giving
  users the flexibility to decide whether an email should be dispatched to the client along with the
  document.
- **Enhanced UI for Email Options**: I've integrated a 'Should Send Email' checkbox into the
  document issuance modal. This checkbox dynamically controls the enabled state of the email content
  and attachment fields, ensuring a streamlined user experience.
- **Backend Email Dispatch Logic**: On the server side, I've updated the issueGreenInvoiceDocument
  resolver to honor the sendEmail flag. If sendEmail is false, the system will prevent emails from
  being sent by clearing the client's email addresses before processing.
- **Automated Linked Document Closure**: I've implemented a feature that automatically closes any
  linked documents when a new document is successfully issued, improving document lifecycle
  management.
- **Improved Green Invoice Remarks**: I've enhanced the Green Invoice integration to automatically
  pull and apply remarks from associated business matches, providing more relevant document
  descriptions.
