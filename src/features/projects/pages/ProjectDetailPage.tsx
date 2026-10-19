// One project. The owner shares it, edits it and attaches files; shared
// teachers set its status and give feedback.
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { FormError } from '@/components/Input';
import { PageHeader, SectionHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { TeacherSelect } from '@/features/people/TeacherSelect';
import { errorMessage } from '@/lib/errors';
import { isAdmin } from '@/lib/permissions';
import { projectStatus } from '@/lib/status';
import type { ProjectStatus } from '../api';
import { Attachments } from '../components/Attachments';
import { FeedbackThread } from '../components/FeedbackThread';
import {
  useDeleteProject,
  useProject,
  useSetProjectStatus,
  useShareProject,
  useUnshareProject,
} from '../hooks';
import styles from './ProjectDetailPage.module.css';

const reviewerStatuses: { value: ProjectStatus; label: string }[] = [
  { value: 'in_review', label: 'In review' },
  { value: 'feedback_given', label: 'Feedback given' },
  { value: 'complete', label: 'Complete' },
];

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const project = useProject(id);
  const share = useShareProject(id);
  const unshare = useUnshareProject(id);
  const setStatus = useSetProjectStatus(id);
  const remove = useDeleteProject();
  // "Share with a teacher" on the list opens this page with ?share=1.
  const [sharing, setSharing] = useState(searchParams.get('share') === '1');
  const [teacherId, setTeacherId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const back = { to: '/projects', label: 'Projects' };
  if (project.isPending) return <LoadingState />;
  if (project.isError)
    return <ErrorState error={project.error} onRetry={() => project.refetch()} />;
  if (!project.data) {
    return (
      <div className="stack">
        <PageHeader back={back} title="Project" />
        <EmptyState icon="folder" title="Not found">
          It may have been deleted, or it isn't shared with you.
        </EmptyState>
      </div>
    );
  }

  const item = project.data;
  const isOwner = item.owner_id === user.id;
  const isSharedTeacher = item.shares.some((s) => s.teacher_id === user.id);
  const canReview = isSharedTeacher || isAdmin(user);

  function submitShare() {
    if (!teacherId) return;
    share.mutate(teacherId, {
      onSuccess: () => {
        setSharing(false);
        setTeacherId('');
      },
    });
  }

  return (
    <div className="stack">
      <PageHeader back={back} title={item.title} subtitle={item.subject ?? undefined} />

      <Card className="stack-tight">
        <div className={styles.statusRow}>
          <StatusBadge map={projectStatus} status={item.status} />
          {!isOwner && item.owner && (
            <span className="meta">
              {item.owner.full_name}
              {item.owner.grade ? ` · Grade ${item.owner.grade}` : ''}
            </span>
          )}
        </div>
        {item.description && <p className={styles.description}>{item.description}</p>}
        {item.link_url && (
          <a href={item.link_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
            <Icon name="link" size={18} />
            Open the project link
          </a>
        )}
      </Card>

      {canReview && (
        <section className="stack-tight" aria-label="Set status">
          <span className="label">Set status</span>
          <div className="row-wrap">
            {reviewerStatuses.map((option) => (
              <Button
                key={option.value}
                size="small"
                variant={item.status === option.value ? 'primary' : 'secondary'}
                aria-pressed={item.status === option.value}
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <FormError message={setStatus.isError ? errorMessage(setStatus.error) : null} />
        </section>
      )}

      {isOwner && (
        <section className="stack-tight" aria-labelledby="sharing-heading">
          <SectionHeader id="sharing-heading" title="Shared with" />
          {item.shares.length === 0 && (
            <p className="meta">Not shared yet. Teachers only see projects you share.</p>
          )}
          <div className="row-wrap">
            {item.shares.map((s) => (
              <span key={s.teacher_id} className={styles.teacher}>
                <Tag tone="accent">{s.teacher?.full_name}</Tag>
                <button
                  type="button"
                  className={styles.unshare}
                  aria-label={`Stop sharing with ${s.teacher?.full_name}`}
                  onClick={() => unshare.mutate(s.teacher_id)}
                >
                  <Icon name="close" size={16} />
                </button>
              </span>
            ))}
          </div>
          <Button variant="secondary" icon="plus" onClick={() => setSharing(true)}>
            Share with a teacher
          </Button>
        </section>
      )}

      <section className="stack-tight" aria-labelledby="feedback-heading">
        <SectionHeader id="feedback-heading" title="Feedback" />
        <FeedbackThread projectId={item.id} feedback={item.feedback} canGiveFeedback={canReview} />
      </section>

      <section className="stack-tight" aria-labelledby="files-heading">
        <SectionHeader id="files-heading" title="Files" />
        <Attachments projectId={item.id} canEdit={isOwner} />
      </section>

      {isOwner && (
        <div className={styles.actions}>
          <ButtonLink to={`/projects/${item.id}/edit`} variant="secondary" icon="edit">
            Edit
          </ButtonLink>
          {item.status !== 'complete' ? (
            <Button variant="secondary" icon="check" onClick={() => setStatus.mutate('complete')}>
              Mark complete
            </Button>
          ) : (
            <span />
          )}
          <Button variant="quiet" icon="trash" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      )}

      <Sheet open={sharing} title="Share with a teacher" onClose={() => setSharing(false)}>
        <p className="meta">They'll be notified and can give feedback.</p>
        <TeacherSelect
          label="Teacher"
          value={teacherId}
          onChange={setTeacherId}
          exclude={item.shares.map((s) => s.teacher_id)}
        />
        <FormError message={share.isError ? errorMessage(share.error) : null} />
        <Button fullWidth disabled={!teacherId} loading={share.isPending} onClick={submitShare}>
          Share
        </Button>
      </Sheet>

      <Sheet
        open={confirmDelete}
        title="Delete this project?"
        onClose={() => setConfirmDelete(false)}
      >
        <p>Its feedback is deleted too. This can't be undone.</p>
        <FormError message={remove.isError ? errorMessage(remove.error) : null} />
        <Button
          variant="alert"
          fullWidth
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(item.id, { onSuccess: () => navigate('/projects', { replace: true }) })
          }
        >
          Delete
        </Button>
      </Sheet>
    </div>
  );
}
