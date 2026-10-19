// The organiser's view of an event: everyone who signed up, grouped by role,
// with their school email (Contact), note and SUPW hours so far.
//   * Organisers (and admins) select, waitlist or move people between roles,
//     and mark attendance once the event has started.
//   * Teachers allowed to (see can_confirm_hours in the migration) confirm hours.
// The database enforces the role caps and who may do what; errors show inline.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { FormError } from '@/components/Input';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { errorMessage } from '@/lib/errors';
import { signupStatus } from '@/lib/status';
import type { EventSignup, SignupChanges, VolunteerEvent } from '../api';
import { useEventSignups, useUpdateSignup } from '../hooks';
import { filledLabel, hasStarted } from '../logic';
import styles from './SignupsManager.module.css';

interface SignupsManagerProps {
  event: VolunteerEvent;
  canManage: boolean;
  canConfirmHours: boolean;
}

export function SignupsManager({ event, canManage, canConfirmHours }: SignupsManagerProps) {
  const signups = useEventSignups(event.id, true);
  const update = useUpdateSignup();
  const started = hasStarted(event);

  function change(signupId: string, changes: SignupChanges) {
    update.mutate({ signupId, changes });
  }

  if (signups.isPending) return <LoadingState label="Loading sign-ups…" />;
  if (signups.isError)
    return <ErrorState error={signups.error} onRetry={() => signups.refetch()} />;
  if (signups.data.length === 0) {
    return (
      <EmptyState icon="users" title="No sign-ups yet">
        Students who sign up will appear here.
      </EmptyState>
    );
  }

  return (
    <div className="stack-tight">
      <FormError message={update.isError ? errorMessage(update.error) : null} />
      {event.roles.map((role) => {
        const people = signups.data.filter((signup) => signup.role_id === role.id);
        return (
          <section key={role.id} className="stack-tight" aria-label={role.name}>
            <h3 className={styles.roleHeading}>
              {role.name} <span className="meta">· {filledLabel(role)}</span>
            </h3>
            {people.length === 0 && <p className="meta">Nobody yet.</p>}
            {people.map((signup) => (
              <SignupRow
                key={signup.signup_id}
                signup={signup}
                event={event}
                started={started}
                canManage={canManage}
                canConfirmHours={canConfirmHours}
                busy={update.isPending}
                onChange={(changes) => change(signup.signup_id, changes)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

interface SignupRowProps {
  signup: EventSignup;
  event: VolunteerEvent;
  started: boolean;
  canManage: boolean;
  canConfirmHours: boolean;
  busy: boolean;
  onChange: (changes: SignupChanges) => void;
}

function SignupRow({
  signup,
  event,
  started,
  canManage,
  canConfirmHours,
  busy,
  onChange,
}: SignupRowProps) {
  const [hours, setHours] = useState(String(event.supw_hours));
  const withdrawn = signup.status === 'withdrawn';
  const otherRoles = event.roles.filter((role) => role.id !== signup.role_id);

  return (
    <Card className={styles.row}>
      <div className={styles.person}>
        <div>
          <p className={styles.name}>{signup.full_name}</p>
          <p className="meta">
            {signup.grade
              ? `Grade ${signup.grade}${signup.section ? ` ${signup.section}` : ''} · `
              : ''}
            {signup.supw_hours_so_far} SUPW hours so far
          </p>
        </div>
        <StatusBadge map={signupStatus} status={signup.status} />
      </div>
      {signup.note && <p className={styles.note}>“{signup.note}”</p>}

      <div className="row-wrap">
        {/* In-app chat is version 2; for now Contact opens the school email. */}
        <a
          className={styles.contact}
          href={`mailto:${signup.email}?subject=${encodeURIComponent(event.title)}`}
        >
          <Icon name="mail" size={18} />
          Contact
        </a>
        {canManage && !withdrawn && signup.status !== 'selected' && (
          <Button size="small" disabled={busy} onClick={() => onChange({ status: 'selected' })}>
            Select
          </Button>
        )}
        {canManage && !withdrawn && signup.status !== 'waitlisted' && (
          <Button
            size="small"
            variant="secondary"
            disabled={busy}
            onClick={() => onChange({ status: 'waitlisted' })}
          >
            Waitlist
          </Button>
        )}
        {canManage && !withdrawn && signup.status !== 'not_selected' && (
          <Button
            size="small"
            variant="quiet"
            disabled={busy}
            onClick={() => onChange({ status: 'not_selected' })}
          >
            Not selected
          </Button>
        )}
      </div>

      {canManage && !withdrawn && otherRoles.length > 0 && (
        <label className={styles.move}>
          <span className="meta">Move to</span>
          <select
            className={styles.select}
            value=""
            disabled={busy}
            onChange={(e) => e.target.value && onChange({ role_id: e.target.value })}
          >
            <option value="">Choose a role…</option>
            {otherRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {started && signup.status === 'selected' && (canManage || canConfirmHours) && (
        <label className={styles.attended}>
          <input
            type="checkbox"
            checked={signup.attended === true}
            disabled={busy || signup.hours_confirmed !== null}
            onChange={(e) => onChange({ attended: e.target.checked })}
          />
          Attended
        </label>
      )}

      {signup.hours_confirmed !== null ? (
        <p className={styles.confirmed}>{signup.hours_confirmed} SUPW hours confirmed</p>
      ) : (
        canConfirmHours &&
        signup.attended && (
          <div className={styles.hours}>
            <label className="meta" htmlFor={`hours-${signup.signup_id}`}>
              SUPW hours
            </label>
            <input
              id={`hours-${signup.signup_id}`}
              className={styles.hoursInput}
              type="number"
              min={0}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
            <Button
              size="small"
              disabled={busy || hours === '' || Number(hours) < 0}
              onClick={() => onChange({ hours_confirmed: Number(hours) })}
            >
              Confirm hours
            </Button>
          </div>
        )
      )}
    </Card>
  );
}
