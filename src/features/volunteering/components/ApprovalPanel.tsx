// Shown to teachers and admins on a student's event that is awaiting
// approval: Approve, or Send back with a note. The database decides who may
// actually do this (any teacher or admin) and notifies the student.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError, TextArea } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import { errorMessage } from '@/lib/errors';
import { useSetEventStatus } from '../hooks';
import styles from './ApprovalPanel.module.css';

export function ApprovalPanel({ eventId }: { eventId: string }) {
  const setStatus = useSetEventStatus(eventId);
  const [sendingBack, setSendingBack] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  function sendBack() {
    if (!note.trim()) {
      setNoteError('Say what needs to change.');
      return;
    }
    setStatus.mutate(
      { status: 'sent_back', note: note.trim() },
      { onSuccess: () => setSendingBack(false) },
    );
  }

  return (
    <Card className="stack-tight">
      <h3>A student created this event</h3>
      <p className="meta">Students can't see it until a teacher approves it.</p>
      <FormError
        message={setStatus.isError && !sendingBack ? errorMessage(setStatus.error) : null}
      />
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setSendingBack(true)}>
          Send back
        </Button>
        <Button
          loading={setStatus.isPending && !sendingBack}
          onClick={() => setStatus.mutate({ status: 'published' })}
        >
          Approve
        </Button>
      </div>

      <Sheet open={sendingBack} title="Send back with a note" onClose={() => setSendingBack(false)}>
        <TextArea
          label="What needs to change?"
          rows={3}
          value={note}
          error={noteError ?? undefined}
          onChange={(event) => {
            setNote(event.target.value);
            setNoteError(null);
          }}
        />
        <FormError message={setStatus.isError ? errorMessage(setStatus.error) : null} />
        <Button fullWidth loading={setStatus.isPending} onClick={sendBack}>
          Send back
        </Button>
      </Sheet>
    </Card>
  );
}
