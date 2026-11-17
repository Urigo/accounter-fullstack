/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH0_DOMAIN: string;
  readonly VITE_AUTH0_FRONTEND_CLIENT_ID: string;
  readonly VITE_AUTH0_AUDIENCE: string;
  // Optional: the resolver falls back to a per-MODE default when it is absent,
  // and `build-env.ts` substitutes an empty string when `GRAPHQL_URL` is unset.
  readonly VITE_GRAPHQL_URL?: string;
  readonly VITE_DEV_AUTH?: string;
  readonly VITE_DEV_AUTH_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
