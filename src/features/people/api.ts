// People lookups shared by several features: choosing a teacher to share a
// project with, supervise a booking, or supervise a collab post. Names and
// roles are readable by everyone signed in; emails are not.
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type StaffMember = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'role'>;

export async function fetchStaff(): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['teacher', 'admin'])
    .order('full_name');
  if (error) throw error;
  return data;
}
