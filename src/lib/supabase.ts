// The one Supabase client for the whole app. Only feature api.ts files import it.
// `Database` (generated types) makes every table, column and function typed.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { env } from './env';

export const supabase = createClient<Database>(
  // Placeholders keep createClient from throwing before .env exists;
  // App.tsx shows setup instructions in that case.
  env.supabaseUrl || 'http://localhost:54321',
  env.supabaseAnonKey || 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // finishes Google / Microsoft sign-in redirects
      flowType: 'pkce',
    },
  },
);
