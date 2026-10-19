// The single row of school-wide settings (app_settings). Everyone signed in can
// read it; only admins change it (src/features/admin).
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type AppSettings = Tables<'app_settings'>;

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from('app_settings').select('*').single();
  if (error) throw error;
  return data;
}
