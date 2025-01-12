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
yarn server:dev
```

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

## Miscellaneous

### Multiple Bank Branches

For Poalim Bank and Discount Bank accounts, your account may appear under multiple branch numbers:

- Your account number and bank number remain the same
- The same account might be associated with 2-3 different branch numbers
- You can configure all relevant branch numbers in the `scripts/seed.ts` file
