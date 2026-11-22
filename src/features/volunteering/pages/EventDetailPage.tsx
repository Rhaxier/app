// One volunteering event: details, roles to sign up for, and, for the
// organiser and staff, the approval panel and everyone who signed up.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError } from '@/components/Input';
import { PageHeader, SectionHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { formatDate, formatDateTime, formatTimeRange } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import {
  canConfirmEventHours,
  canDeleteEvent,
  canEditEvent,
  isAdmin,
  isStaff,
} from '@/lib/permissions';
import { volunteerEventStatus } from '@/lib/status';
import type { EventRole, MySignup, VolunteerEvent } from '../api';
import { ApprovalPanel } from '../components/ApprovalPanel';
import { RoleCard } from '../components/RoleCard';
import { SignUpSheet } from '../components/SignUpSheet';
import { SignupsManager } from '../components/SignupsManager';
import {
  useDeleteEvent,
  useEvent,
  useMySignups,
  useSetEventStatus,
  useSetMySignupStatus,
  useSignUp,
} from '../hooks';
import { isActiveSignup, isSignupOpen } from '../logic';
import styles from './EventDetailPage.module.css';

// Why a student can't sign up for a role, or null if they can.
function blockedReason(
  event: VolunteerEvent,
  userId: string,
  mine: MySignup[],
  role: EventRole,
): string | null {
  if (event.creator_id === userId) return "You're organising this event.";
  if (event.status === 'awaiting_approval' || event.status === 'sent_back') {
    return 'Sign-ups open once a teacher approves this event.';
  }
  if (!isSignupOpen(event)) return 'Sign-ups are closed.';
  const elsewhere = mine.some((signup) => signup.role_id !== role.id && isActiveSignup(signup));
  if (!event.allow_multiple_roles && elsewhere)
    return 'You can sign up for one role in this event.';
  return null;
}

export function EventDetailPage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const event = useEvent(id);
  const mySignups = useMySignups(user.id);
  const signUp = useSignUp(id);
  const setMyStatus = useSetMySignupStatus();
  const setStatus = useSetEventStatus(id);
  const remove = useDeleteEvent();
  const [signingUpFor, setSigningUpFor] = useState<EventRole | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const back = { to: '/volunteer', label: 'Volunteer' };
  if (event.isPending) return <LoadingState />;
  if (event.isError) return <ErrorState error={event.error} onRetry={() => event.refetch()} />;
  if (!event.data) {
    return (
      <div className="stack">
        <PageHeader back={back} title="Event" />
        <EmptyState icon="heart" title="Not found">
          It may have been removed, or it's still waiting for a teacher's approval.
        </EmptyState>
      </div>
    );
  }

  const item = event.data;
  const mine = (mySignups.data ?? []).filter((signup) => signup.event_id === item.id);
  const isOrganiser = item.creator_id === user.id;
  const canSeeSignups = isOrganiser || isStaff(user);

  return (
    <div className="stack">
      <PageHeader
        back={back}
        eyebrow={item.organiser_label || item.creator?.full_name}
        title={item.title}
      />

      {/* Tablets and laptops: the event on the left, its roles (where you
          sign up) on the right. On a phone, one after the other as before. */}
      <div className="split">
        <div className="stack">
          <Card className="stack-tight">
            {item.status !== 'published' && (
              <StatusBadge map={volunteerEventStatus} status={item.status} />
            )}
            <dl className={styles.facts}>
              <dt>When</dt>
              <dd>
                {formatDate(item.starts_at)}, {formatTimeRange(item.starts_at, item.ends_at)}
              </dd>
              <dt>Where</dt>
              <dd>
                {item.room ? (
                  <Link to={`/map?room=${encodeURIComponent(item.room.code)}`}>
                    {item.room.name} ({item.room.code})
                  </Link>
                ) : (
                  item.place_text
                )}
              </dd>
              <dt>SUPW hours</dt>
              <dd>{item.supw_hours}</dd>
              {item.signup_deadline && (
                <>
                  <dt>Sign up by</dt>
                  <dd>{formatDateTime(item.signup_deadline)}</dd>
                </>
              )}
              <dt>Roles</dt>
              <dd>
                {item.allow_multiple_roles
                  ? 'You may sign up for more than one'
                  : 'One role per student'}
              </dd>
            </dl>
            {item.description && <p className={styles.description}>{item.description}</p>}
          </Card>

          {/* The creator's view while a teacher hasn't approved it yet. */}
          {isOrganiser && item.status === 'awaiting_approval' && (
            <Card className="stack-tight">
              <h3>Waiting for a teacher</h3>
              <p className="meta">
                Only teachers and admins can see it until one of them approves it.
              </p>
            </Card>
          )}
          {isOrganiser && item.status === 'sent_back' && (
            <Card className="stack-tight">
              <h3>A teacher sent this back</h3>
              <p className={styles.note}>“{item.approval_note}”</p>
              <FormError message={setStatus.isError ? errorMessage(setStatus.error) : null} />
              <div className={styles.twoButtons}>
                <ButtonLink to={`/volunteer/${item.id}/edit`} variant="secondary">
                  Edit
                </ButtonLink>
                <Button
                  loading={setStatus.isPending}
                  onClick={() => setStatus.mutate({ status: 'awaiting_approval' })}
                >
                  Resubmit
                </Button>
              </div>
            </Card>
          )}

          {isStaff(user) && !isOrganiser && item.status === 'awaiting_approval' && (
            <ApprovalPanel eventId={item.id} />
          )}
        </div>

        <section className="stack-tight" aria-labelledby="roles-heading">
          <SectionHeader id="roles-heading" title="Roles" />
          <FormError message={setMyStatus.isError ? errorMessage(setMyStatus.error) : null} />
          <ul className="stack-tight">
            {item.roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                mySignup={mine.find((signup) => signup.role_id === role.id)}
                blockedReason={blockedReason(item, user.id, mine, role)}
                busy={setMyStatus.isPending}
                onSignUp={() => setSigningUpFor(role)}
                onWithdraw={(signup) =>
                  setMyStatus.mutate({ signupId: signup.id, status: 'withdrawn' })
                }
                onSignUpAgain={(signup) =>
                  setMyStatus.mutate({ signupId: signup.id, status: 'applied' })
                }
              />
            ))}
          </ul>
        </section>
      </div>

      {canSeeSignups && item.status !== 'awaiting_approval' && item.status !== 'sent_back' && (
        <section className="stack-tight" aria-labelledby="signups-heading">
          <SectionHeader id="signups-heading" title="Sign-ups" />
          <SignupsManager
            event={item}
            canManage={isOrganiser || isAdmin(user)}
            canConfirmHours={canConfirmEventHours(user, item)}
          />
        </section>
      )}

      {(canEditEvent(user, item) || canDeleteEvent(user, item)) && (
        <div className={styles.twoButtons}>
          {canEditEvent(user, item) && (
            <ButtonLink to={`/volunteer/${item.id}/edit`} variant="secondary" icon="edit">
              Edit
            </ButtonLink>
          )}
          {isOrganiser && item.status === 'published' && (
            <Button
              variant="secondary"
              loading={setStatus.isPending}
              onClick={() => setStatus.mutate({ status: 'closed' })}
            >
              Close sign-ups
            </Button>
          )}
          {isOrganiser && item.status === 'closed' && (
            <Button
              variant="secondary"
              loading={setStatus.isPending}
              onClick={() => setStatus.mutate({ status: 'published' })}
            >
              Reopen
            </Button>
          )}
          {canDeleteEvent(user, item) && (
            <Button variant="quiet" icon="trash" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      )}

      <SignUpSheet
        key={signingUpFor?.id ?? 'none'}
        roleName={signingUpFor?.name ?? null}
        submitting={signUp.isPending}
        error={signUp.isError ? errorMessage(signUp.error) : null}
        onClose={() => {
          setSigningUpFor(null);
          signUp.reset();
        }}
        onSubmit={(note) =>
          signingUpFor &&
          signUp.mutate(
            { roleId: signingUpFor.id, note },
            { onSuccess: () => setSigningUpFor(null) },
          )
        }
      />

      <Sheet
        open={confirmDelete}
        title="Delete this event?"
        onClose={() => setConfirmDelete(false)}
      >
        <p>Its roles and sign-ups are deleted too. This can't be undone.</p>
        <FormError message={remove.isError ? errorMessage(remove.error) : null} />
        <Button
          variant="alert"
          fullWidth
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(item.id, { onSuccess: () => navigate('/volunteer', { replace: true }) })
          }
        >
          Delete
        </Button>
      </Sheet>
    </div>
  );
}
