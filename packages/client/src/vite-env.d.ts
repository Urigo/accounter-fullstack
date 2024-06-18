/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_DEFAULT_FINANCIAL_ENTITY_ID?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
