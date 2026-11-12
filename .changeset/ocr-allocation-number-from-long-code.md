---
'@accounter/server': patch
---

OCR now reads the allocation number (מספר הקצאה) correctly when it is printed as the last 9 digits
of a longer "Tax Authorities Code". The model copies the code verbatim and the server takes the last
9 digits, instead of asking the model to slice them (it often returned a window shifted by a digit).
