// Admin > Moderation. One queue: content people reported (shown inline, with
// who reported it and why), collab posts a teacher hid pending review, and
// content an admin removed. Actions: dismiss the report, hide or unhide (collab
// posts), remove (a soft delete, with a reason), restore, or open the author
// on the Users screen to pause their posting.
// Teachers see reported content in Approvals; this queue is admins only.
import { useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TextField } from '@/components/Input';
import { MotionList } from '@/components/MotionList';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { relativeTime } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import type { ModerationItem, ModeratedTable } from '../api';
import { AdminPage } from '../components/AdminPage';
import { useModerate, useModerationQueue } from '../hooks';
import styles from './ModerationPage.module.css';

type Show = ModerationItem['kind'];

const tableName: Record<ModeratedTable, string> = {
  collab_posts: 'Collab post',
  announcements: 'Announcement',
  volunteer_events: 'Volunteering event',
};

const openLink: Record<ModeratedTable, (id: string) => string> = {
  collab_posts: (id) => `/collab/${id}`,
  announcements: (id) => `/announcements/${id}`,
  volunteer_events: (id) => `/volunteer/${id}`,
};

export function ModerationPage() {
  const queue = useModerationQueue();
  const [show, setShow] = useState<Show>('reported');
  const count = (kind: Show) => queue.data?.filter((item) => item.kind === kind).length ?? 0;
  const shown = queue.data?.filter((item) => item.kind === show);

  return (
    <AdminPage title="Moderation" description="Reported, hidden and removed content.">
      <SegmentedControl
        label="Show"
        value={show}
        onChange={setShow}
        options={[
          { value: 'reported', label: `Reported (${count('reported')})` },
          { value: 'hidden', label: `Hidden (${count('hidden')})` },
          { value: 'removed', label: `Removed (${count('removed')})` },
        ]}
      />
      {queue.isPending && <LoadingState />}
      {queue.isError && <ErrorState error={queue.error} onRetry={() => queue.refetch()} />}
      {shown?.length === 0 && (
        <EmptyState icon="check" title="Nothing here">
          {show === 'reported' ? 'New reports appear here as soon as they are made.' : null}
        </EmptyState>
      )}
      <MotionList
        items={shown}
        keyOf={(item) => `${item.kind}-${item.report_id ?? item.target_id}`}
        className="stack-tight"
      >
        {(item) => <ModerationCard item={item} />}
      </MotionList>
    </AdminPage>
  );
}

function ModerationCard({ item }: { item: ModerationItem }) {
  const moderate = useModerate();
  const [removing, setRemoving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [reason, setReason] = useState('');
  const target = { table: item.target_table, id: item.target_id };

  return (
    <Card className={styles.card}>
      <div className={styles.top}>
        <span className="label">{tableName[item.target_table]}</span>
        <span className="row-wrap">
          {item.is_hidden && <Badge tone="attention">Hidden</Badge>}
          {item.is_removed && <Badge tone="quiet">Removed</Badge>}
        </span>
      </div>

      {/* The content itself, so it can be judged without leaving the queue. */}
      <blockquote className={styles.content}>
        <p className={styles.title}>{item.title ?? '(content no longer exists)'}</p>
        {item.excerpt && <p className={styles.excerpt}>{item.excerpt}</p>}
        <p className="meta">By {item.author_name ?? 'unknown'}</p>
      </blockquote>

      <p>
        {item.kind === 'reported' && (
          <>
            <strong>{item.reporter_name}</strong> reported it: “{item.reason}”
          </>
        )}
        {item.kind === 'hidden' && (
          <>Hidden by a teacher{item.reason ? `: “${item.reason}”` : ''}</>
        )}
        {item.kind === 'removed' && <>Removed{item.reason ? `: “${item.reason}”` : ''}</>}
      </p>
      <p className="meta">{relativeTime(item.happened_at)}</p>

      <div className="row-wrap">
        {!item.is_removed && (
          <ButtonLink to={openLink[item.target_table](item.target_id)} variant="ghost" size="small">
            Open
          </ButtonLink>
        )}
        {item.kind === 'reported' && item.report_id && (
          <Button
            size="small"
            variant="secondary"
            disabled={moderate.isPending}
            onClick={() => moderate.mutate({ action: 'dismiss', reportId: item.report_id! })}
          >
            Dismiss report
          </Button>
        )}
        {item.target_table === 'collab_posts' && !item.is_removed && (
          <Button
            size="small"
            variant="secondary"
            disabled={moderate.isPending}
            onClick={() =>
              moderate.mutate({ action: item.is_hidden ? 'unhide' : 'hide', ...target })
            }
          >
            {item.is_hidden ? 'Unhide' : 'Hide'}
          </Button>
        )}
        {item.is_removed ? (
          <Button size="small" onClick={() => setRestoring(true)}>
            Restore
          </Button>
        ) : (
          <Button size="small" variant="alert" onClick={() => setRemoving(true)}>
            Remove
          </Button>
        )}
        {item.author_id && (
          <ButtonLink to={`/admin/users?open=${item.author_id}`} variant="ghost" size="small">
            Suspend the author…
          </ButtonLink>
        )}
      </div>

      <ConfirmDialog
        open={removing}
        title="Remove this content?"
        confirmLabel="Remove"
        busy={moderate.isPending}
        error={moderate.isError ? errorMessage(moderate.error) : null}
        onClose={() => setRemoving(false)}
        onConfirm={() =>
          moderate.mutate(
            { action: 'remove', ...target, reason },
            { onSuccess: () => setRemoving(false) },
          )
        }
      >
        <p>
          It disappears for everyone except admins, including its author. You can restore it later
          from Removed. Its open reports are marked as dealt with.
        </p>
        <TextField
          label="Reason (kept in the record)"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={restoring}
        title="Restore this content?"
        confirmLabel="Restore"
        tone="primary"
        busy={moderate.isPending}
        onClose={() => setRestoring(false)}
        onConfirm={() =>
          moderate.mutate(
            { action: 'restore', ...target },
            { onSuccess: () => setRestoring(false) },
          )
        }
      >
        <p>Everyone who could see it before sees it again.</p>
      </ConfirmDialog>
    </Card>
  );
}
