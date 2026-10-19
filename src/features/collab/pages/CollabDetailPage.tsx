// One collab post. What you see depends on who you are:
//   owner      requests (accept / decline / contact), the team, edit, close, delete
//   requester  ask to join, withdraw; once accepted, the team with emails
//   staff      the requests (read-only), hide for review (teachers), remove (admins)
//   everyone   a Report button
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Chip';
import { FormError, TextArea, TextField } from '@/components/Input';
import { PageHeader, SectionHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { relativeTime } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { isAdmin, isStaff } from '@/lib/permissions';
import { collabStatus } from '@/lib/status';
import { RequestsList } from '../components/RequestsList';
import { TeamList } from '../components/TeamList';
import {
  useDeletePost,
  useMyRequests,
  usePost,
  useReportPost,
  useRequestToJoin,
  useSetPostClosed,
  useSetPostHidden,
  useSetRequestStatus,
} from '../hooks';
import { filledLabel, joinState } from '../logic';
import styles from './CollabDetailPage.module.css';

export function CollabDetailPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const post = usePost(id);
  const myRequests = useMyRequests(user.id);
  const ask = useRequestToJoin(id);
  const setRequest = useSetRequestStatus();
  const setClosed = useSetPostClosed(id);
  const setHidden = useSetPostHidden(id);
  const report = useReportPost(id);
  const remove = useDeletePost();

  const [asking, setAsking] = useState(searchParams.get('ask') === '1');
  const [message, setMessage] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [hiding, setHiding] = useState(false);
  const [hideReason, setHideReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const back = { to: '/collab', label: 'Collab finder' };
  if (post.isPending) return <LoadingState />;
  if (post.isError) return <ErrorState error={post.error} onRetry={() => post.refetch()} />;
  if (!post.data) {
    return (
      <div className="stack">
        <PageHeader back={back} title="Collab post" />
        <EmptyState icon="users" title="Not found">
          It may have been removed, or hidden while a teacher reviews it.
        </EmptyState>
      </div>
    );
  }

  const item = post.data;
  const myRequest = myRequests.data?.find((request) => request.post_id === item.id);
  const state = joinState(item, myRequest, user.id);
  const isOwner = state === 'own';
  const owner = item.owner?.full_name ?? 'Student';

  return (
    <div className="stack">
      <PageHeader back={back} title={item.title} />

      <Card className="stack-tight">
        <div className={styles.who}>
          <Avatar name={owner} initials={item.owner?.avatar_initials} />
          <div className={styles.whoText}>
            <p className={styles.name}>{owner}</p>
            <p className="meta">
              {item.owner?.grade ? `Grade ${item.owner.grade} · ` : ''}
              {relativeTime(item.created_at)}
            </p>
          </div>
          <StatusBadge map={collabStatus} status={item.status} />
        </div>
        {item.description && <p className={styles.description}>{item.description}</p>}
        <p className={`label ${styles.muted}`}>Looking for</p>
        <div className="row-wrap">
          {item.skills.map((skill) => (
            <Tag key={skill}>{skill}</Tag>
          ))}
        </div>
        <p className="meta">
          {filledLabel(item)}
          {item.supervisor && ` · Supervised by ${item.supervisor.full_name}`}
        </p>
      </Card>

      {item.hidden_by && (
        <Card className={styles.hidden}>
          <p className={styles.hiddenTitle}>Hidden while a teacher reviews it</p>
          {item.hidden_reason && <p>{item.hidden_reason}</p>}
        </Card>
      )}

      {/* The requester's side */}
      {state === 'can_ask' && (
        <Button fullWidth onClick={() => setAsking(true)}>
          Ask to join
        </Button>
      )}
      {state === 'requested' && myRequest && (
        <Card className="stack-tight">
          <p>You've asked to join. The owner will accept or decline, and may email you first.</p>
          <Button
            variant="secondary"
            loading={setRequest.isPending}
            onClick={() => setRequest.mutate({ requestId: myRequest.id, status: 'withdrawn' })}
          >
            Withdraw my request
          </Button>
        </Card>
      )}
      {state === 'declined' && (
        <p className="meta">Thanks for offering. The owner has gone with other people this time.</p>
      )}
      {state === 'full' && <p className="meta">This team is full.</p>}
      {state === 'on_team' && myRequest && (
        <section className="stack-tight" aria-labelledby="team-heading">
          <SectionHeader id="team-heading" title="Your team" />
          <TeamList postId={item.id} />
          <Button
            variant="quiet"
            loading={setRequest.isPending}
            onClick={() => setRequest.mutate({ requestId: myRequest.id, status: 'withdrawn' })}
          >
            Leave the team
          </Button>
        </section>
      )}
      <FormError message={setRequest.isError ? errorMessage(setRequest.error) : null} />

      {/* The owner's side, and the staff safeguarding view */}
      {(isOwner || isStaff(user)) && (
        <section className="stack-tight" aria-labelledby="requests-heading">
          <SectionHeader id="requests-heading" title="Requests" />
          <RequestsList
            postId={item.id}
            postTitle={item.title}
            canDecide={isOwner}
            isFull={item.status === 'full'}
          />
        </section>
      )}
      {isOwner && item.accepted_count > 0 && (
        <section className="stack-tight" aria-labelledby="owner-team-heading">
          <SectionHeader id="owner-team-heading" title="Team" />
          <TeamList postId={item.id} />
        </section>
      )}
      {isOwner && (
        <div className={styles.actions}>
          <ButtonLink to={`/collab/${item.id}/edit`} variant="secondary" icon="edit">
            Edit
          </ButtonLink>
          <Button
            variant="secondary"
            loading={setClosed.isPending}
            onClick={() => setClosed.mutate(item.status !== 'closed')}
          >
            {item.status === 'closed' ? 'Reopen' : 'Close post'}
          </Button>
        </div>
      )}

      {isStaff(user) && !isOwner && (
        <Card className="stack-tight">
          <h3>Moderation</h3>
          <FormError message={setHidden.isError ? errorMessage(setHidden.error) : null} />
          {item.hidden_by ? (
            <Button
              variant="secondary"
              loading={setHidden.isPending}
              onClick={() => setHidden.mutate({ hiddenBy: null, reason: null })}
            >
              Unhide
            </Button>
          ) : (
            <Button variant="secondary" icon="eyeOff" onClick={() => setHiding(true)}>
              Hide pending review
            </Button>
          )}
          {isAdmin(user) && (
            <Button variant="quiet" icon="trash" onClick={() => setConfirmDelete(true)}>
              Remove post
            </Button>
          )}
        </Card>
      )}
      {isOwner && (
        <Button variant="quiet" icon="trash" onClick={() => setConfirmDelete(true)}>
          Delete post
        </Button>
      )}

      {!isOwner && (
        <Button variant="ghost" icon="flag" onClick={() => setReporting(true)}>
          Report this post
        </Button>
      )}

      <Sheet open={asking} title="Ask to join" onClose={() => setAsking(false)}>
        <TextField
          label="What you bring"
          placeholder="e.g. I've done CAD in Fusion 360"
          maxLength={300}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="meta">The owner will see your name, grade and school email.</p>
        <FormError message={ask.isError ? errorMessage(ask.error) : null} />
        <Button
          fullWidth
          loading={ask.isPending}
          onClick={() => ask.mutate(message, { onSuccess: () => setAsking(false) })}
        >
          Send request
        </Button>
      </Sheet>

      <Sheet open={reporting} title="Report this post" onClose={() => setReporting(false)}>
        {report.isSuccess ? (
          <p>Thanks. Staff will look at it.</p>
        ) : (
          <>
            <TextArea
              label="What's wrong?"
              rows={3}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
            <p className="meta">
              Only staff see reports. If someone is in danger, tell a teacher now.
            </p>
            <FormError message={report.isError ? errorMessage(report.error) : null} />
            <Button
              fullWidth
              disabled={!reportReason.trim()}
              loading={report.isPending}
              onClick={() => report.mutate(reportReason)}
            >
              Send report
            </Button>
          </>
        )}
      </Sheet>

      <Sheet open={hiding} title="Hide pending review" onClose={() => setHiding(false)}>
        <TextField
          label="Reason (shown to the owner)"
          value={hideReason}
          onChange={(e) => setHideReason(e.target.value)}
        />
        <Button
          fullWidth
          loading={setHidden.isPending}
          onClick={() =>
            setHidden.mutate(
              { hiddenBy: user.id, reason: hideReason.trim() || null },
              { onSuccess: () => setHiding(false) },
            )
          }
        >
          Hide post
        </Button>
      </Sheet>

      <Sheet
        open={confirmDelete}
        title={isOwner ? 'Delete this post?' : 'Remove this post?'}
        onClose={() => setConfirmDelete(false)}
      >
        <p>
          {isOwner ? 'Its requests are deleted too.' : 'The removal is recorded in the audit log.'}{' '}
          This can't be undone.
        </p>
        <FormError message={remove.isError ? errorMessage(remove.error) : null} />
        <Button
          variant="alert"
          fullWidth
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(item.id, { onSuccess: () => navigate('/collab', { replace: true }) })
          }
        >
          {isOwner ? 'Delete' : 'Remove'}
        </Button>
      </Sheet>
    </div>
  );
}
