# Accounter

Manage your taxes.

## Getting started

1. Switch to the correct version of Node.js:

```sh
nvm use $(cat .node-version)
```

2. Install dependencies:

```sh
yarn install
```

3. Create `.env` file:

```sh
cp .env.template .env
```

4. Run setup:

```sh
yarn local:setup
```

5. Run client and server:

```sh
yarn build
yarn client:dev
yarn subgraphs:dev
yarn gateway:dev
# Also helpful while developing:
yarn generate:watch
```

Or use the VSCode Terminals extension: `fabiospampinato.vscode-terminals` to run all this for you in
different terminals.

6. Visit [http://localhost:3001/](http://localhost:3001/) and sign in. The credentials to log in are
   in your `.env` file under `AUTHORIZED_USERS`. Set the hashed password in the `.env` file. e.g.
   replace `SECRET` with `$2b$10$SuqbDX5r6qZidiMbAcGnFOPloNQSRQrLEPShZjplabtfdN.QzS4ba`. And then
   use the password `SECRET` to log in.

7. Seed the database with your business details. Edit `scripts/seed.ts` with your info, then run
   `yarn seed`.

8. Load your data into the database (first set correct env vars):

```sh
yarn scrape
```

9. Generate businesses by visiting http://localhost:4000/graphql

Set your headers at the bottom:

```json
{
  "authorization": "Basic [YOUR_TOKEN]"
}
```

You can find `YOUR_TOKEN` by in the GraphQL request headers in your browser's `Network` tab.

Then run this mutation:

```gql
mutation {
  batchGenerateBusinessesOutOfTransactions {
    id
    name
  }
}
```

## Server Architecture

Accounter uses a federated GraphQL architecture consisting of subgraphs and a gateway.

- **Gateway**: Central entry point that composes the complete API (`localhost:4000`)
- **Legacy Subgraph**: Handles core business logic (`localhost:4001`)

### Subgraphs

The legacy subgraph runs on port 4001 and provides the core business functionality. It features:

- GraphQL Yoga server with GraphiQL interface
- Authentication plugin
- GraphQL Modules for modular code organization
- GraphQL Hive integration for schema registry and metrics
- Support for deferred and streamed responses

To explore the subgraph schema:

1. Start the server: `yarn subgraphs:dev`
2. Visit `http://localhost:4001/subgraphs/legacy`
3. Use the GraphiQL interface to explore available operations

### Gateway

The gateway (port 4000) uses GraphQL Hive to compose the supergraph schema. It requires:

- Valid Hive CDN endpoint
- Hive CDN access key
- Configuration in `gateway.config.ts`

To use the gateway:

1. Set up Hive credentials in your environment
2. Start the gateway: `yarn gateway:dev`
3. Visit `http://localhost:4000/graphql`

4. Generate businesses by visiting http://localhost:4000/graphql

## Miscellaneous

### Multiple Bank Branches

For Poalim Bank and Discount Bank accounts, your account may appear under multiple branch numbers:

- Your account number and bank number remain the same
- The same account might be associated with 2-3 different branch numbers
- You can configure all relevant branch numbers in the `scripts/seed.ts` file

### Enable Google Drive

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing one
3. Enable Google Drive API:
   - Navigate to "APIs & Services" > "Library"
   - Search for and enable "Google Drive API"
4. Create API key:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Restrict the key to Google Drive API only
5. Add to your `.env`:
   ```
   GOOGLE_DRIVE_API_KEY=your_api_key_here
   ```

### Enable OCR (with Anthropic)

1. Sign up for an Anthropic API key at
   [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Add to your `.env`:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```
3. OCR functionality will now be available for processing images and documents
