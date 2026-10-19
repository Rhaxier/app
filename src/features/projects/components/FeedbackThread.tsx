// Teacher feedback on a project, newest first, with a box for shared teachers
// (and admins) to add more. Adding feedback notifies the student.
import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { FormError, TextArea } from '@/components/Input';
import { relativeTime } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import type { Feedback } from '../api';
import { useAddFeedback } from '../hooks';
import styles from './FeedbackThread.module.css';

interface FeedbackThreadProps {
  projectId: string;
  feedback: Feedback[];
  canGiveFeedback: boolean;
}

export function FeedbackThread({ projectId, feedback, canGiveFeedback }: FeedbackThreadProps) {
  const add = useAddFeedback(projectId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setError('Write some feedback first.');
      return;
    }
    setError(null);
    add.mutate(body, { onSuccess: () => setBody('') });
  }

  return (
    <div className="stack-tight">
      {feedback.length === 0 && <p className="meta">No feedback yet.</p>}
      {feedback.map((item) => (
        <div key={item.id} className={styles.item}>
          <Avatar
            name={item.author?.full_name ?? 'Teacher'}
            initials={item.author?.avatar_initials}
            size="small"
            tone="ink"
          />
          <div>
            <p className="meta">
              {item.author?.full_name} · {relativeTime(item.created_at)}
            </p>
            <p className={styles.body}>{item.body}</p>
          </div>
        </div>
      ))}
      {canGiveFeedback && (
        <form className="stack-tight" onSubmit={handleSubmit} noValidate>
          <TextArea
            label="Your feedback"
            rows={3}
            maxLength={2000}
            value={body}
            error={error ?? undefined}
            onChange={(e) => setBody(e.target.value)}
          />
          <FormError message={add.isError ? errorMessage(add.error) : null} />
          <Button type="submit" loading={add.isPending}>
            Send feedback
          </Button>
        </form>
      )}
    </div>
  );
}
