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
