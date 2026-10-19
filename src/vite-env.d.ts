/// <reference types="vite/client" />

// The env vars the app reads. Values come from .env (see .env.example).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AUTH_PROVIDER?: string;
  readonly VITE_SCHOOL_EMAIL_DOMAIN?: string;
  readonly VITE_ENABLE_PUSH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
