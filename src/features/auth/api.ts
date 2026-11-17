// Raw Supabase calls for signing in and out, and for loading the signed-in
// person's profile. Pages never call these directly; they use ./hooks.ts.
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { Enums, Tables } from '@/types/database';

export type Profile = Pick<
  Tables<'profiles'>,
  'id' | 'full_name' | 'role' | 'grade' | 'section' | 'avatar_initials'
>;

/** The signed-in person: their profile, email and staff responsibilities. */
export interface CurrentUser extends Profile {
  email: string;
  responsibilities: Enums<'responsibility_kind'>[];
  /** Set while an admin has paused their posting (see SuspensionNotice). */
  posting_suspended_until: string | null;
  suspension_reason: string | null;
}

export type SchoolProvider = 'google' | 'azure';

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

// Sends the browser to Google or Microsoft, which sends it back to the app.
// The database then checks the email domain (handle_new_user in the identity
// migration) and refuses accounts from outside the school.
export async function signInWithSchoolAccount(provider: SchoolProvider): Promise<void> {
  const domain = env.schoolEmailDomain.includes('[') ? '' : env.schoolEmailDomain;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
      // Microsoft only shares the email address if asked for it.
      scopes: provider === 'azure' ? 'email' : undefined,
      // A hint so the account picker shows school accounts first.
      queryParams: domain
        ? provider === 'google'
          ? { hd: domain }
          : { domain_hint: domain }
        : undefined,
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchCurrentUser(userId: string, email: string): Promise<CurrentUser> {
  // Emails can't be read from profiles (see the identity migration), so the
  // email comes from the sign-in session instead.
  // Whether posting is paused isn't in the readable columns either (others
  // mustn't see it), so my_account_status() returns just your own.
  const [profile, responsibilities, status] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, grade, section, avatar_initials')
      .eq('id', userId)
      .single(),
    supabase.from('responsibilities').select('kind').eq('user_id', userId),
    supabase.rpc('my_account_status').maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (responsibilities.error) throw responsibilities.error;
  if (status.error) throw status.error;
  return {
    ...profile.data,
    email,
    responsibilities: responsibilities.data.map((row) => row.kind),
    posting_suspended_until: status.data?.posting_suspended_until ?? null,
    suspension_reason: status.data?.suspension_reason ?? null,
  };
}
