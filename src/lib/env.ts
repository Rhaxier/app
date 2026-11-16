// Reads the .env settings once, with safe defaults, so the rest of the app
// never touches import.meta.env directly.

export type AuthProvider = 'dev' | 'google' | 'azure';

function readAuthProvider(value: string | undefined): AuthProvider {
  if (value === 'google' || value === 'azure') return value;
  return 'dev';
}

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  authProvider: readAuthProvider(import.meta.env.VITE_AUTH_PROVIDER),
  schoolEmailDomain: import.meta.env.VITE_SCHOOL_EMAIL_DOMAIN ?? '',
  enablePush: import.meta.env.VITE_ENABLE_PUSH === 'true',
  // Forces the indoor map and traced rooms on, for trying them locally. The
  // real switch is app_settings.map_indoor_live, set by rooms migration B.
  indoorMap: import.meta.env.VITE_INDOOR_MAP === 'true',
};

// True when .env has been filled in. If not, the app shows setup instructions
// instead of crashing with a confusing network error.
export const isSupabaseConfigured =
  env.supabaseUrl.startsWith('http') && env.supabaseAnonKey.length > 20;
