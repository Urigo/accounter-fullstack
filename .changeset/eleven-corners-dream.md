---
'@accounter/gmail-listener': patch
---

- **Dockerfile Introduction**: A new Dockerfile has been added for the `gmail-listener` package,
  enabling its containerization using a Playwright base image.
- **Docker Scripts**: Two new `yarn` scripts, `docker:build` and `docker:run`, were added to the
  `gmail-listener`'s `package.json` for convenient Docker image building and container execution.
