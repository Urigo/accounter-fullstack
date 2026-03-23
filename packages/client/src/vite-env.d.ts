/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_DEFAULT_FINANCIAL_ENTITY_ID?: string;
  readonly VITE_AUTH0_DOMAIN: string;
  readonly VITE_AUTH0_FRONTEND_CLIENT_ID: string;
  readonly VITE_AUTH0_AUDIENCE: string;
  readonly VITE_GRAPHQL_URL?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
