---
'@accounter/email-ingestion-gateway': patch
---

Fixes the gateway Docker build: the Dockerfile now copies the `opcn1214-generator` workspace
manifest before `yarn install --immutable`, which otherwise failed because Yarn tried to drop that
workspace from `yarn.lock`.
