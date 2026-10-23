// Admin > Staff emails (Q3). Anyone on this list becomes a teacher the first
// time they sign in; adding someone who already has a student account
// promotes them straight away.
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { FormError, TextField } from '@/components/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { errorMessage } from '@/lib/errors';
import { useAddStaffEmail, useRemoveStaffEmail, useStaffEmails } from '../hooks';
import { validateStaffEmail } from '../logic';
import styles from './ListPage.module.css';
import { AdminPage } from '../components/AdminPage';

export function StaffEmailsPage() {
  const emails = useStaffEmails();
  const add = useAddStaffEmail();
  const remove = useRemoveStaffEmail();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validateStaffEmail(
      email,
      (emails.data ?? []).map((row) => row.email),
    );
    setError(problem);
    if (!problem) add.mutate(email, { onSuccess: () => setEmail('') });
  }

  return (
    <AdminPage title="Staff emails" description="These people become teachers when they sign in.">
      <form className={styles.addRow} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Add an email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error ?? undefined}
        />
        <Button type="submit" variant="secondary" loading={add.isPending}>
          Add
        </Button>
      </form>
      <FormError
        message={
          add.error ? errorMessage(add.error) : remove.error ? errorMessage(remove.error) : null
        }
      />
      {emails.isPending && <LoadingState />}
      {emails.isError && <ErrorState error={emails.error} onRetry={() => emails.refetch()} />}
      {emails.data?.length === 0 && <EmptyState icon="mail" title="The list is empty" />}
      {emails.data && emails.data.length > 0 && (
        <Card>
          <ul>
            {emails.data.map((row) => (
              <li key={row.id} className={styles.row}>
                <span className={styles.mono}>{row.email}</span>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${row.email}`}
                  onClick={() => remove.mutate(row.id)}
                >
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="meta">
        Removing an email doesn't change anyone's role. Use Users and roles for that.
      </p>
    </AdminPage>
  );
}
