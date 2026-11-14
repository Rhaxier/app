// Admin > Features > Announcements. The default expiry for new announcements,
// and every announcement, including scheduled and expired ones (only admins
// and each post's author can see those): pin or unpin, edit, delete.
import { useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import type { Announcement } from '@/features/announcements/api';
import { bylineOf } from '@/features/announcements/format';
import {
  useAnnouncements,
  useDeleteAnnouncement,
  useSetPinned,
} from '@/features/announcements/hooks';
import { announcementState } from '@/features/announcements/validation';
import { formatDateTime } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { AdminPage } from '../components/AdminPage';
import { footnotes, pageIntros } from '../strings';
import { SettingNumber } from '../components/SettingControls';
import styles from './ListPage.module.css';

type Show = 'all' | 'live' | 'scheduled' | 'expired';

const stateBadge = {
  live: { label: 'Live', tone: 'good' },
  scheduled: { label: 'Scheduled', tone: 'attention' },
  expired: { label: 'Expired', tone: 'quiet' },
} as const;

export function AnnouncementsAdminPage() {
  const announcements = useAnnouncements();
  const pin = useSetPinned();
  const remove = useDeleteAnnouncement();
  const [show, setShow] = useState<Show>('all');
  const [deleting, setDeleting] = useState<Announcement | null>(null);

  const shown = (announcements.data ?? []).filter(
    (a) => show === 'all' || announcementState(a) === show,
  );

  return (
    <AdminPage
      title="Announcements"
      description={pageIntros.announcements}
      actions={
        <ButtonLink to="/announcements/new" size="small" icon="plus">
          New
        </ButtonLink>
      }
    >
      <Card className="stack-tight">
        <SettingNumber
          setting="announcement_default_expiry_days"
          label="Default expiry (days)"
          hint={footnotes.announcements.defaultExpiry}
          min={1}
          max={365}
          optional
        />
      </Card>

      <SegmentedControl
        label="Show"
        value={show}
        onChange={setShow}
        options={[
          { value: 'all', label: 'All' },
          { value: 'live', label: 'Live' },
          { value: 'scheduled', label: 'Scheduled' },
          { value: 'expired', label: 'Expired' },
        ]}
      />

      {announcements.isPending && <LoadingState />}
      {announcements.isError && (
        <ErrorState error={announcements.error} onRetry={() => announcements.refetch()} />
      )}
      {announcements.data && shown.length === 0 && (
        <EmptyState icon="megaphone" title="Nothing here" />
      )}
      <ul className="stack-tight">
        {shown.map((a) => {
          const state = announcementState(a);
          return (
            <Card as="li" key={a.id} className="stack-tight">
              <div className={styles.row}>
                <h3>{a.title}</h3>
                <Badge tone={stateBadge[state].tone}>{stateBadge[state].label}</Badge>
              </div>
              <p className="meta">
                {bylineOf(a)} · {state === 'scheduled' ? 'appears' : 'posted'}{' '}
                {formatDateTime(a.publish_at)}
                {a.expires_at ? ` · expires ${formatDateTime(a.expires_at)}` : ''}
              </p>
              <div className="row-wrap">
                <Button
                  size="small"
                  variant={a.pinned ? 'primary' : 'secondary'}
                  icon="pin"
                  aria-pressed={a.pinned}
                  disabled={pin.isPending}
                  onClick={() => pin.mutate({ id: a.id, pinned: !a.pinned })}
                >
                  {a.pinned ? 'Pinned' : 'Pin'}
                </Button>
                <ButtonLink to={`/announcements/${a.id}/edit`} size="small" variant="secondary">
                  Edit
                </ButtonLink>
                <Button size="small" variant="ghost" onClick={() => setDeleting(a)}>
                  Delete
                </Button>
              </div>
            </Card>
          );
        })}
      </ul>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.title ?? ''}"?`}
        confirmLabel="Delete announcement"
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      >
        <p>It disappears for everyone. This can't be undone.</p>
      </ConfirmDialog>
    </AdminPage>
  );
}
