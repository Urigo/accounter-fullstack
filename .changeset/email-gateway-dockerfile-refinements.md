---
'@accounter/email-ingestion-gateway': patch
---

Refine the email-ingestion-gateway container build. Rename `DockerFile` to `Dockerfile`, fix the
`docker:build`/`docker:run` workspace scripts to use the correct build context (`../../`) and paths,
copy only workspace manifests before `yarn install` for better layer caching, run the production
stage as the non-root `pwuser` from the Playwright base image (copying artifacts with `--chown`
instead of a costly recursive `chown -R /app`), and add a root `.dockerignore` so the repo-root
build context stays small and host `node_modules` don't clobber the installed dependencies.
