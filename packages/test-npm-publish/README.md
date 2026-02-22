# @accounter/test-npm-publish

Temporary test package for debugging NPM publish workflow with OIDC authentication.

## Purpose

This package is used to test and debug the CI/CD pipeline for publishing to NPM using OIDC
authentication method. It will be removed once the publishing workflow is verified.

## Usage

```typescript
import { hello } from '@accounter/test-npm-publish'

console.log(hello('World'))
// Output: Hello, World! This is a test package.
```

## Development

```bash
# Build the package
yarn build

# Publish locally (for initial setup)
npm publish
```
