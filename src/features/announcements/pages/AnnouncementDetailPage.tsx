// One announcement in full, with Edit and Delete for its author or an admin.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError } from '@/components/Input';
import { PageHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { useSections } from '@/features/school/hooks';
import { formatDateTime } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { canEditAnnouncement } from '@/lib/permissions';
import { audienceLabel, bylineOf } from '../format';
import { useAnnouncement, useDeleteAnnouncement } from '../hooks';
import styles from './AnnouncementDetailPage.module.css';

export function AnnouncementDetailPage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const announcement = useAnnouncement(id);
  const remove = useDeleteAnnouncement();
  const sections = useSections().data;
  const [confirming, setConfirming] = useState(false);

  const back = { to: '/announcements', label: 'Announcements' };
  if (announcement.isPending) return <LoadingState />;
  if (announcement.isError) {
    return <ErrorState error={announcement.error} onRetry={() => announcement.refetch()} />;
  }
  // null = it doesn't exist, or RLS hides it from this person. Same answer.
  if (!announcement.data) {
    return (
      <div className="stack">
        <PageHeader back={back} title="Announcement" />
        <EmptyState icon="megaphone" title="Not found">
          It may have been removed, or it isn't meant for you.
        </EmptyState>
      </div>
    );
  }

  const item = announcement.data;
  return (
    <div className="stack">
      <PageHeader back={back} title="Announcement" />
      <Card as="article" tone={item.pinned ? 'accent' : 'default'} className="stack-tight">
        <p className={item.pinned ? 'label' : 'meta'}>
          {item.pinned ? `Pinned · ${bylineOf(item)}` : bylineOf(item)}
        </p>
        <h2>{item.title}</h2>
        {item.body && <p className={styles.body}>{item.body}</p>}
        <p className="meta">
          {formatDateTime(item.published_at)} · {audienceLabel(item, sections)}
        </p>
      </Card>

      {canEditAnnouncement(user, item.author_id) && (
        <div className={styles.actions}>
          <ButtonLink to={`/announcements/${item.id}/edit`} variant="secondary" icon="edit">
            Edit
          </ButtonLink>
          <Button variant="secondary" icon="trash" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </div>
      )}

      <Sheet
        open={confirming}
        title="Delete this announcement?"
        onClose={() => setConfirming(false)}
      >
        <p>It disappears from everyone's feed. This can't be undone.</p>
        <FormError message={remove.isError ? errorMessage(remove.error) : null} />
        <Button
          variant="alert"
          fullWidth
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(item.id, {
              onSuccess: () => navigate('/announcements', { replace: true }),
            })
          }
        >
          Delete
        </Button>
      </Sheet>
    </div>
  );
}
