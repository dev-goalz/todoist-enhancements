/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Base URL of the API, e.g. `/api/v1` for a self-hosted server. Defaults to Todoist. */
  readonly VITE_API_BASE?: string;
}
