# green-invoice-graphql

Graphql-Mesh wrapper on top of Green Invoice's APIs

# issues with green invoice

1. on file upload (draft expense) - some details are responded (successful import), but file is
   missing from the drafts search
2. on file upload (draft expense) - an ID is returned. this ID doesn't exist on getExpense. search
   drafts doesn't return IDs. so what is it used for?
3. why is most of the expense data missing on response of searchDrafts?
4. Is there swagger / json schema / postman collection to the entire collection
