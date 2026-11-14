// Admin > Overview, the dashboard's home. Two halves:
//   * Needs attention: what's waiting and for how long, each card linking
//     straight to the queue where it gets handled.
//   * Activity: headline numbers and two small charts for the last 7 or 30 days.
// Every number is counted in the database by an admin-only function
// (supabase/migrations/20261023120000_admin_overview.sql).
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/PageHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ErrorState, LoadingState } from '@/components/States';
import { useOpenReports } from '@/features/fixit/hooks';
import { reportTitle } from '@/features/fixit/logic';
import type { AttentionKind, AttentionRow } from '../api';
import { AdminPage } from '../components/AdminPage';
import { pageIntros } from '../strings';
import { BarList } from '../components/BarList';
import { StatTile } from '../components/StatTile';
import { SupwExportButton } from '../components/SupwExportButton';
import { useAttention, useMetrics, useSupwByGrade, useVenueUtilisation } from '../hooks';
import { hours, percent, waitingFor } from '../logic';
import styles from './OverviewPage.module.css';

type Period = '7' | '30';

export function OverviewPage() {
  const [period, setPeriod] = useState<Period>('7');
  const days = Number(period);

  return (
    <AdminPage title="Overview" description={pageIntros.overview} fullWidth>
      <NeedsAttention />

      <section className="stack-tight" aria-labelledby="activity-heading">
        <SectionHeader
          id="activity-heading"
          title="Activity"
          action={
            <SegmentedControl
              compact
              label="Period"
              value={period}
              onChange={setPeriod}
              options={[
                { value: '7', label: 'Last 7 days' },
                { value: '30', label: 'Last 30 days' },
              ]}
            />
          }
        />
        <Numbers days={days} />
        <div className={styles.charts}>
          <Utilisation days={days} />
          <SupwHours days={days} />
        </div>
      </section>
    </AdminPage>
  );
}

// ---------------------------------------------------------------------------
// Needs attention
// ---------------------------------------------------------------------------

function NeedsAttention() {
  const attention = useAttention();
  const reports = useOpenReports(3);

  if (attention.isPending) return <LoadingState count={4} label="Loading what needs attention…" />;
  if (attention.isError)
    return <ErrorState error={attention.error} onRetry={() => attention.refetch()} />;

  const row = (kind: AttentionKind): AttentionRow =>
    attention.data.find((r) => r.kind === kind) ?? {
      kind,
      item_count: 0,
      urgent_count: 0,
      oldest_at: null,
    };
  const venueRequests = row('venue_requests');
  const awaitingTeacher = row('bookings_awaiting_teacher');
  const hoursToConfirm = row('hours_to_confirm');
  const openReports = row('open_reports');
  const reported = row('reported_content');
  const hidden = row('hidden_posts');
  const events = row('events_to_approve');

  return (
    <section className="stack-tight" aria-labelledby="attention-heading">
      <SectionHeader id="attention-heading" title="Needs attention" />
      <div className={styles.attention}>
        <AttentionCard
          title="Pending approvals"
          count={venueRequests.item_count + awaitingTeacher.item_count + hoursToConfirm.item_count}
          link={{ to: '/approvals', label: 'Open Approvals' }}
        >
          <Breakdown
            rows={[
              { label: 'Venue requests', row: venueRequests, to: '/approvals#q-venues' },
              { label: 'Waiting for a supervising teacher', row: awaitingTeacher },
              { label: 'SUPW hours to confirm', row: hoursToConfirm, to: '/approvals#q-hours' },
            ]}
          />
        </AttentionCard>

        <AttentionCard
          title="Open fix-it reports"
          count={openReports.item_count}
          note={
            openReports.item_count > 0
              ? `${openReports.urgent_count} urgent · ${waitingFor(openReports.oldest_at)}`
              : undefined
          }
          link={{ to: '/admin/reports', label: 'Open the queue' }}
        >
          {reports.data && reports.data.length > 0 && (
            <ul className={styles.items}>
              {reports.data.map((report) => (
                <li key={report.id}>
                  <Link to={`/reports/${report.id}`}>
                    {report.urgent && <strong>Urgent: </strong>}
                    {reportTitle(report.description, 44)}
                  </Link>
                  {report.room_code && <span className="meta"> · {report.room_code}</span>}
                </li>
              ))}
            </ul>
          )}
        </AttentionCard>

        <AttentionCard
          title="Reported posts"
          count={reported.item_count + hidden.item_count}
          link={{ to: '/admin/moderation', label: 'Open Moderation' }}
        >
          <Breakdown
            rows={[
              { label: 'Reports to review', row: reported },
              { label: 'Posts hidden pending review', row: hidden },
            ]}
          />
        </AttentionCard>

        <AttentionCard
          title="Student events to approve"
          count={events.item_count}
          note={events.item_count > 0 ? waitingFor(events.oldest_at) : undefined}
          link={{ to: '/approvals#q-events', label: 'Open Approvals' }}
        />
      </div>
    </section>
  );
}

interface AttentionCardProps {
  title: string;
  count: number;
  note?: string;
  link: { to: string; label: string };
  children?: ReactNode;
}

function AttentionCard({ title, count, note, link, children }: AttentionCardProps) {
  return (
    <Card as="article" className={styles.card} aria-label={`${title}: ${count}`}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <p className={count > 0 ? styles.count : `${styles.count} ${styles.zero}`}>{count}</p>
      {count === 0 ? (
        <p className="meta">Nothing waiting.</p>
      ) : (
        note && <p className="meta">{note}</p>
      )}
      {count > 0 && children}
      <ButtonLink to={link.to} variant="secondary" size="small" className={styles.open}>
        {link.label}
      </ButtonLink>
    </Card>
  );
}

function Breakdown({ rows }: { rows: { label: string; row: AttentionRow; to?: string }[] }) {
  return (
    <ul className={styles.items}>
      {rows
        .filter(({ row }) => row.item_count > 0)
        .map(({ label, row, to }) => (
          <li key={label}>
            {to ? <Link to={to}>{label}</Link> : label}: <strong>{row.item_count}</strong>
            <span className="meta"> · {waitingFor(row.oldest_at)}</span>
          </li>
        ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

function Numbers({ days }: { days: number }) {
  const metrics = useMetrics();
  if (metrics.isPending) return <LoadingState shape="row" count={2} label="Loading numbers…" />;
  if (metrics.isError)
    return <ErrorState error={metrics.error} onRetry={() => metrics.refetch()} />;
  const m = metrics.data.find((row) => row.days === days);
  if (!m) return null;

  return (
    <div className={styles.tiles}>
      <StatTile label="Active people" value={m.active_users} detail="signed in or took part" />
      <StatTile
        label="New fix-it reports"
        value={m.new_reports}
        detail={
          m.avg_days_to_resolve === null
            ? `${m.resolved_reports} resolved`
            : `${m.resolved_reports} resolved · avg ${m.avg_days_to_resolve} days`
        }
      />
      <StatTile
        label="Venue bookings"
        value={m.bookings_held}
        detail={`held · ${m.bookings_requested} requested`}
      />
      <StatTile label="SUPW hours confirmed" value={hours(m.supw_hours_confirmed)} />
      <StatTile
        label="Collab posts"
        value={m.collab_posts_created}
        detail={`created · ${m.collab_posts_filled} filled`}
      />
    </div>
  );
}

function Utilisation({ days }: { days: number }) {
  const utilisation = useVenueUtilisation(days);
  return (
    <Card className="stack-tight">
      <h3>Venue utilisation</h3>
      <p className="meta">Approved booked hours ÷ bookable hours, last {days} days.</p>
      {utilisation.isPending && <LoadingState shape="row" count={3} />}
      {utilisation.isError && (
        <ErrorState error={utilisation.error} onRetry={() => utilisation.refetch()} />
      )}
      {utilisation.data && utilisation.data.length === 0 && <p className="meta">No venues yet.</p>}
      {utilisation.data && utilisation.data.length > 0 && (
        <BarList
          title={`Venue utilisation, last ${days} days`}
          kind="share"
          columns={['Venue', 'Utilisation']}
          bars={utilisation.data.map((venue) => ({
            key: venue.venue_id,
            label: venue.venue_name,
            value: venue.utilisation ?? 0,
            valueLabel: `${percent(venue.utilisation)} · ${hours(venue.booked_hours)} of ${hours(venue.bookable_hours)} h`,
          }))}
        />
      )}
    </Card>
  );
}

function SupwHours({ days }: { days: number }) {
  const supw = useSupwByGrade(days);
  return (
    <Card className="stack-tight">
      <h3>SUPW hours confirmed, by grade</h3>
      <p className="meta">Last {days} days.</p>
      {supw.isPending && <LoadingState shape="row" count={3} />}
      {supw.isError && <ErrorState error={supw.error} onRetry={() => supw.refetch()} />}
      {supw.data && supw.data.length === 0 && (
        <p className="meta">No hours were confirmed in this period.</p>
      )}
      {supw.data && supw.data.length > 0 && (
        <BarList
          title={`SUPW hours confirmed by grade, last ${days} days`}
          kind="amount"
          columns={['Grade', 'Hours']}
          bars={supw.data.map((row) => ({
            key: String(row.grade ?? 'none'),
            label: row.grade === null ? 'No grade set' : `Grade ${row.grade}`,
            value: row.hours,
            valueLabel: `${hours(row.hours)} h · ${row.students} ${row.students === 1 ? 'student' : 'students'}`,
          }))}
        />
      )}
      <SupwExportButton />
    </Card>
  );
}
