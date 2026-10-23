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

/**
 * What every screen needs first, including the sign-in screen (it works
 * signed out): the school's name, logo and accent colour, and the
 * maintenance message while one is on (public_status() in the system migration).
 */
export interface PublicStatus {
  school_name: string;
  logo_url: string | null;
  accent_color: string;
  maintenance_message: string | null;
  maintenance_until: string | null;
}

export async function fetchPublicStatus(): Promise<PublicStatus | null> {
  const { data, error } = await supabase.rpc('public_status').maybeSingle();
  if (error) throw error;
  return data as PublicStatus | null;
}

// ---------------------------------------------------------------------------
// Feature switches (Admin > System > Feature switches). Off: the tab and
// entry points disappear for everyone but admins, and the database refuses new
// content for that feature. What's already there stays readable.
// ---------------------------------------------------------------------------

export type FeatureName =
  'announcements' | 'volunteering' | 'projects' | 'collab' | 'venues' | 'map' | 'fixit';

export interface FeatureFlag {
  id: string;
  feature: FeatureName;
  enabled: boolean;
}

export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase.from('feature_flags').select('id, feature, enabled');
  if (error) throw error;
  return data as FeatureFlag[];
}

export async function setFeatureFlag(feature: FeatureName, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('feature_flags').update({ enabled }).eq('feature', feature);
  if (error) throw error;
}
