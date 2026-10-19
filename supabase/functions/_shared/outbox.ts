// Shared by the send-emails and send-push Edge Functions (Deno).
// Reads queued rows from an outbox table with the service role key, which
// bypasses RLS. That key must never reach the browser; Supabase injects it
// into Edge Functions as SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2';

export interface OutboxRow {
  id: string;
  recipient_id: string;
  kind: 'immediate' | 'digest';
  payload: {
    type: string;
    title: string;
    body: string;
    link: string | null;
    urgent: boolean;
    email?: string;
  };
  created_at: string;
}

export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

// These functions are for the scheduler (pg_cron) or an admin, never for app
// users: anyone signed in has a valid JWT, so we check for the service key.
export function isServiceCaller(request: Request): boolean {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return Boolean(key) && request.headers.get('Authorization') === `Bearer ${key}`;
}

export async function queuedRows(
  table: 'email_outbox' | 'push_outbox',
  kind?: 'immediate' | 'digest',
) {
  let query = serviceClient()
    .from(table)
    .select('id, recipient_id, kind, payload, created_at')
    .eq('status', 'queued')
    .order('created_at')
    .limit(500);
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OutboxRow[];
}

// One message per person: a digest lists all of that person's items.
export function groupByRecipient(rows: OutboxRow[]): Map<string, OutboxRow[]> {
  const groups = new Map<string, OutboxRow[]>();
  for (const row of rows) {
    const list = groups.get(row.recipient_id) ?? [];
    list.push(row);
    groups.set(row.recipient_id, list);
  }
  return groups;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
