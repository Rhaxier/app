// Edge Function: send-emails (STUB, docs/OPEN_QUESTIONS.md Q7).
//
// What it will do: pick up queued rows from email_outbox and email staff.
//   POST /functions/v1/send-emails?kind=immediate   run every few minutes
//   POST /functions/v1/send-emails?kind=digest      run once a day
//
// What it does now: a dry run. It builds the emails it WOULD send, returns a
// preview, and leaves every row `queued`. No email provider is chosen yet.
//
// To switch on real sending (e.g. with Resend, https://resend.com):
//   1. `npx supabase secrets set RESEND_API_KEY=... EMAIL_FROM="School App <noreply@[school-domain]>"`
//   2. In the loop below, POST each email to https://api.resend.com/emails with
//      header `Authorization: Bearer <RESEND_API_KEY>` and body
//      { from, to, subject, text }.
//   3. Mark each row sent: update email_outbox set status = 'sent', sent_at = now();
//      on error set status = 'failed', attempts = attempts + 1, last_error = <message>.
//   4. Schedule both calls with pg_cron + pg_net (see README, "Email and push").
import { groupByRecipient, isServiceCaller, json, queuedRows, type OutboxRow } from '../_shared/outbox.ts';

interface Email {
  to: string;
  subject: string;
  text: string;
  outboxIds: string[];
}

function buildEmail(rows: OutboxRow[], kind: 'immediate' | 'digest'): Email {
  const to = rows[0].payload.email ?? '(no email on file)';
  const lines = rows.map((row) => `• ${row.payload.title}\n  ${row.payload.body}\n  Open: ${row.payload.link ?? '/'}`);
  const subject =
    kind === 'digest'
      ? `School App: ${rows.length} item${rows.length === 1 ? '' : 's'} for you today`
      : rows[0].payload.title;
  return { to, subject, text: lines.join('\n\n'), outboxIds: rows.map((row) => row.id) };
}

Deno.serve(async (request) => {
  if (!isServiceCaller(request)) {
    return json({ error: 'Only the scheduler (service role) can run this.' }, 401);
  }
  const kind = new URL(request.url).searchParams.get('kind') === 'digest' ? 'digest' : 'immediate';

  try {
    const rows = await queuedRows('email_outbox', kind);
    const emails = [...groupByRecipient(rows).values()].map((group) => buildEmail(group, kind));
    return json({ dryRun: true, kind, queuedRows: rows.length, emails: emails.length, preview: emails.slice(0, 5) });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
