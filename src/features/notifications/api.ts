// Raw Supabase calls for the inbox, the unread badge and mute settings.
// Notifications are created only by database triggers; the app reads them and
// marks them read (the only column it may change).
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { NotificationType } from './types';

export type Notification = Pick<
  Tables<'notifications'>,
  'id' | 'type' | 'title' | 'body' | 'link' | 'urgent' | 'read_at' | 'created_at'
>;

export async function fetchNotifications(): Promise<Notification[]> {
  // RLS returns only the signed-in person's rows, so no "where me" is needed.
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, urgent, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  // head: true asks only for the count, not the rows.
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}

export async function fetchMutedTypes(): Promise<NotificationType[]> {
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('type')
    .eq('muted', true);
  if (error) throw error;
  return data.map((row) => row.type);
}

export async function setMuted(type: NotificationType, muted: boolean): Promise<void> {
  // Upsert: create the setting row the first time, update it after that.
  // user_id is filled in by the database (default auth.uid()).
  const { error } = await supabase
    .from('notification_prefs')
    .upsert({ type, muted }, { onConflict: 'user_id,type' });
  if (error) throw error;
}

/**
 * Calls onChange whenever one of this person's notifications is added or
 * changed (Supabase Realtime). Returns a function that stops listening.
 */
export function subscribeToNotifications(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
