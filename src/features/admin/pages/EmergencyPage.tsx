// Admin > Notifications > Emergency broadcast. A short message that becomes a
// pinned, urgent announcement and an urgent notification to every active
// person (phone push for everyone, immediate email for staff who get email).
// The database refuses a second one within 10 minutes, so a double tap or two
// admins at once can't send it twice. Every broadcast is in the audit log.
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TextArea, TextField } from '@/components/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { formatDateTime } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { AdminPage } from '../components/AdminPage';
import { useBroadcasts, useSendBroadcast } from '../hooks';
import { validateBroadcast } from '../logic';
import styles from './EmergencyPage.module.css';

export function EmergencyPage() {
  const send = useSendBroadcast();
  const history = useBroadcasts();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ title?: string; message?: string }>({});
  const [confirming, setConfirming] = useState(false);

  function review(event: FormEvent) {
    event.preventDefault();
    const found = validateBroadcast(title, message);
    setErrors(found);
    if (Object.keys(found).length === 0) setConfirming(true);
  }

  return (
    <AdminPage
      title="Emergency broadcast"
      description="Tell everyone at once. For real emergencies and drills only."
    >
      <div className={styles.warning} role="note">
        <p>
          <strong>Everyone with the app is notified immediately</strong>, and it stays pinned at the
          top of every feed. In a real emergency, follow the school's own procedure first.
        </p>
      </div>

      <form className="stack" onSubmit={review} noValidate>
        <TextField
          label="Title"
          placeholder="e.g. Early closure today"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <TextArea
          label="Message"
          rows={4}
          maxLength={500}
          hint="What's happening and what people should do. Up to 500 characters."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          error={errors.message}
        />
        <Button type="submit" variant="alert" fullWidth>
          Review and send…
        </Button>
      </form>

      <ConfirmDialog
        open={confirming}
        title="Send this to everyone now?"
        confirmLabel="Send to everyone"
        busy={send.isPending}
        error={send.isError ? errorMessage(send.error) : null}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          send.mutate(
            { title: title.trim(), message: message.trim() },
            {
              onSuccess: () => {
                setConfirming(false);
                setTitle('');
                setMessage('');
              },
            },
          )
        }
      >
        <div className={styles.preview}>
          <p className={styles.previewTitle}>{title}</p>
          <p>{message}</p>
        </div>
        <p className="meta">
          It can't be unsent. Another broadcast is possible 10 minutes after this one.
        </p>
      </ConfirmDialog>

      <section className="stack-tight" aria-labelledby="broadcast-history">
        <h2 id="broadcast-history">Sent</h2>
        {history.isPending && <LoadingState shape="row" count={2} />}
        {history.isError && <ErrorState error={history.error} onRetry={() => history.refetch()} />}
        {history.data?.length === 0 && <EmptyState icon="megaphone" title="No broadcasts yet" />}
        <ul className="stack-tight">
          {history.data?.map((b) => (
            <Card as="li" key={b.id} className="stack-tight">
              <h3>{b.title}</h3>
              <p>{b.message}</p>
              <p className="meta">
                {formatDateTime(b.created_at)} · by {b.sender?.full_name ?? 'an admin'} · to{' '}
                {b.recipients} people
              </p>
            </Card>
          ))}
        </ul>
      </section>
    </AdminPage>
  );
}
