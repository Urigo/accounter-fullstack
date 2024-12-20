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

## Node ES Modules with TypeScript

Latest Typescript and Node - as bare-bone as possible example app

I wanted to start a simple Node project where I can install the latest things I want and using as
little compilation from Typescript as possible.

I remembered Node announced
[Node 13 support ESModules without experimental flags](https://medium.com/@nodejs/announcing-core-node-js-support-for-ecmascript-modules-c5d6dc29b663),
checked out the [official documentation](https://nodejs.org/api/esm.html) but couldn't find a simple
bare bone example, so maybe that would help someone.

I've committed the dist folder as well to see how the output from Typescript.

Would love suggestions on how to make it better or to point to a better example!

## What I've done (so you can tell me what I should have done...)

### Node

- `type: module`: Tell Node that `.js` files are ES Modules
- `--es-module-specifier-resolution=node`: By default, Node wants file extensions in import but
  [TypeScript doesn't include file extension in it's output](https://github.com/microsoft/TypeScript/issues/16577).
  so this enable automatic extension resolution in Node.

### TypeScript

- `"module": "esnext"`: Make Typescript output ES Modules
- `"target": "es2020"`: Highest target (from `3.8.0-beta`)

## Run app

1. Install latest Node (Notice that I've placed the `engines` field on `package.json` so try to make
   sure you have the exact version or simply delete it from `package.json`
2. Install dependencies - `yarn`
3. Compile with `tsc -w` and run Node with `nodemon` - `yarn dev`
4. You can also use `yarn compile` and `yarn start` separately

## Want to import from a commonjs package?

Here is a branch of the example with including a commonjs pacakge (`pg`):

https://github.com/Urigo/typescript-node-es-modules-example/commit/98304173e964713955be3a92b4e355a857376dca

> The
> [renovate.json](https://github.com/Urigo/typescript-node-es-modules-example/blob/master/renovate.json)
> file has nothing to do with the project itself. It's a file to activate
> [RenovateBot](https://github.com/renovatebot/renovate) to automatically PR this repository when a
> new version of any dependency of that project has been published
