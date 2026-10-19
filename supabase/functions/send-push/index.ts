// Edge Function: send-push (STUB, docs/OPEN_QUESTIONS.md Q8).
//
// What it will do: pick up queued rows from push_outbox and send phone
// notifications through Firebase Cloud Messaging (Android, and iOS via APNs).
//
// What it does now: a dry run. It reports what it WOULD send and leaves every
// row `queued`. Push needs store apps and a Firebase project first.
//
// To switch on real sending:
//   1. Create a Firebase project; add the Android and iOS apps; upload the
//      Apple push key to Firebase.
//   2. Store device tokens: the app registers them when VITE_ENABLE_PUSH=true
//      (src/features/notifications/push.ts). Add a `device_tokens` table
//      (user_id, token, platform) with RLS "users manage their own tokens".
//   3. `npx supabase secrets set FCM_SERVICE_ACCOUNT='<json>'`, then in the loop
//      below call the FCM HTTP v1 API for each of the recipient's tokens.
//   4. Mark rows sent / failed as in send-emails, and schedule this function
//      every minute with pg_cron + pg_net.
import { groupByRecipient, isServiceCaller, json, queuedRows } from '../_shared/outbox.ts';

Deno.serve(async (request) => {
  if (!isServiceCaller(request)) {
    return json({ error: 'Only the scheduler (service role) can run this.' }, 401);
  }
  try {
    const rows = await queuedRows('push_outbox');
    const people = groupByRecipient(rows);
    const preview = [...people.entries()].slice(0, 5).map(([recipient, items]) => ({
      recipient,
      notifications: items.map((item) => ({
        title: item.payload.title,
        body: item.payload.body,
        link: item.payload.link,
      })),
    }));
    return json({ dryRun: true, queuedRows: rows.length, recipients: people.size, preview });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
