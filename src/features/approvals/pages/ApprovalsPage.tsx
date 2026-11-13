// Approvals (staff only; design PDF page 9, "Staff get one queue"): the desk
// view. Counts lead the page, then one queue of everything waiting on this
// person, oldest first, with quick actions on every row:
//   * student volunteering events to approve      (any teacher or admin)
//   * venue requests                              (venues staff and admins)
//   * student bookings you were asked to supervise
//   * fix-it reports routed to your team          (facilities / IT staff)
//   * SUPW hours to confirm                       (see can_confirm_hours)
//   * content people reported                     (all staff)
// Each row reuses the feature's own hooks and actions; this page only gathers
// them. On a laptop the queue lines up as a table; on a phone the rows stack.
// The student screens are unchanged: this is added on top. Handled items fade
// out of the queue and new ones slide in (MotionList).
import { useState, type ReactNode } from 'react';
import { ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { MotionList } from '@/components/MotionList';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/States';
import { SupwExportButton } from '@/features/admin/components/SupwExportButton';
import { useContentReports } from '@/features/admin/hooks';
import { useCurrentUser } from '@/features/auth/hooks';
import { useReports } from '@/features/fixit/hooks';
import { isOpen } from '@/features/fixit/logic';
import { useLiveBookings, usePendingForReview, useToSupervise } from '@/features/venues/hooks';
import { useEvents, useHoursToConfirm } from '@/features/volunteering/hooks';
import { greeting } from '@/lib/dates';
import { canReviewVenues, hasResponsibility, isAdmin } from '@/lib/permissions';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { ContentReportCard } from '../components/ContentReportCard';
import { EventApprovalCard } from '../components/EventApprovalCard';
import { HoursCard } from '../components/HoursCard';
import { QueueHeading } from '../components/QueueRow';
import { ReportQueueCard } from '../components/ReportQueueCard';
import { VenueQueueRow } from '../components/VenueQueueRow';
import { queueFilters, shortWait, sortQueue, type QueueEntry, type QueueType } from '../logic';
import styles from './ApprovalsPage.module.css';

interface QueueItem extends QueueEntry {
  row: (oldest: boolean) => ReactNode;
}

export function ApprovalsPage() {
  useDocumentTitle('Approvals');
  const user = useCurrentUser();
  const reviewsVenues = canReviewVenues(user);
  const events = useEvents();
  const venueRequests = usePendingForReview(reviewsVenues);
  const toSupervise = useToSupervise(user.id);
  const reports = useReports();
  const hours = useHoursToConfirm();
  const contentReports = useContentReports();
  useLiveBookings();
  const [filter, setFilter] = useState<'all' | QueueType>('all');

  const eventsToApprove = (events.data ?? []).filter(
    (event) => event.status === 'awaiting_approval' && event.creator_id !== user.id,
  );
  const routedReports = (reports.data ?? []).filter(
    (report) => isOpen(report.status) && user.responsibilities.includes(report.routed_to),
  );
  const openContent = (contentReports.data ?? []).filter((report) => report.status === 'open');

  // Everything waiting on you, as one list, oldest first.
  const queue = sortQueue<QueueItem>([
    ...eventsToApprove.map((event) => ({
      key: `event-${event.id}`,
      type: 'event' as const,
      since: event.created_at,
      row: (oldest: boolean) => <EventApprovalCard event={event} oldest={oldest} />,
    })),
    ...(reviewsVenues ? (venueRequests.data ?? []) : []).map((booking) => ({
      key: `venue-${booking.id}`,
      type: 'venue' as const,
      since: booking.created_at,
      row: (oldest: boolean) => <VenueQueueRow booking={booking} mode="review" oldest={oldest} />,
    })),
    ...(toSupervise.data ?? []).map((booking) => ({
      key: `supervise-${booking.id}`,
      type: 'venue' as const,
      since: booking.created_at,
      row: (oldest: boolean) => (
        <VenueQueueRow booking={booking} mode="supervise" oldest={oldest} />
      ),
    })),
    ...routedReports.map((report) => ({
      key: `fixit-${report.id}`,
      type: 'fixit' as const,
      since: report.created_at,
      row: (oldest: boolean) => <ReportQueueCard report={report} oldest={oldest} />,
    })),
    ...(hours.data ?? []).map((item) => ({
      key: `hours-${item.signup_id}`,
      type: 'hours' as const,
      since: item.event_starts_at,
      row: (oldest: boolean) => <HoursCard item={item} oldest={oldest} />,
    })),
    ...openContent.map((report) => ({
      key: `content-${report.id}`,
      type: 'content' as const,
      since: report.created_at,
      row: (oldest: boolean) => <ContentReportCard report={report} oldest={oldest} />,
    })),
  ]);
  const oldestKey = queue[0]?.key;
  const filters = queueFilters(queue);
  // If the chosen kind has just been cleared, show everything again.
  const shown = filters.some((option) => option.value === filter)
    ? queue.filter((item) => filter === 'all' || item.type === filter)
    : queue;
  const loading = [events, toSupervise, reports, hours, contentReports].some(
    (query) => query.isPending,
  );
  const urgent = routedReports.filter((report) => report.urgent).length;
  const venueCount = queue.filter((item) => item.type === 'venue').length;

  return (
    <div className={`stack ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.topRow}>
          <p className="label">Staff · Approvals</p>
          <div className={styles.headerActions}>
            {/* ⌘K / Ctrl+K also opens search from anywhere (AppLayout). */}
            <ButtonLink to="/search" variant="quiet" size="small" className={styles.jump}>
              <Icon name="search" size={16} />
              Search or jump to…
              <kbd className={styles.kbd}>⌘K</kbd>
            </ButtonLink>
            {isAdmin(user) && (
              <ButtonLink to="/admin" variant="secondary" size="small" icon="shield">
                Admin
              </ButtonLink>
            )}
          </div>
        </div>
        <h1>
          {greeting()}, <span className={styles.name}>{user.full_name}.</span>
        </h1>
      </header>

      {/* Counts lead the page. */}
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Waiting on you</dt>
          <dd>
            <span className={styles.number}>{queue.length}</span>
            {queue[0] && <span className={styles.flag}>oldest {shortWait(queue[0].since)}</span>}
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>Open fix-it</dt>
          <dd>
            <span className={styles.number}>{routedReports.length}</span>
            {urgent > 0 && <span className={styles.flag}>{urgent} urgent</span>}
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>Venue requests</dt>
          <dd>
            <span className={styles.number}>{venueCount}</span>
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>Hours to confirm</dt>
          <dd>
            <span className={styles.number}>{hours.data?.length ?? 0}</span>
          </dd>
        </div>
      </dl>

      <section className="stack-tight" aria-labelledby="queue-heading">
        <div className={styles.queueHeader}>
          <h2 id="queue-heading" className={styles.queueTitle}>
            Approvals queue <span className={styles.queueCount}>{queue.length}</span>
          </h2>
          {filters.length > 2 && (
            <SegmentedControl
              label="Show"
              compact
              value={filters.some((option) => option.value === filter) ? filter : 'all'}
              onChange={setFilter}
              options={filters}
            />
          )}
        </div>

        {loading && <LoadingState shape="row" />}
        {!loading && queue.length === 0 && (
          <EmptyState icon="check" title="Nothing waiting for you">
            New requests, reports and approvals will appear here.
          </EmptyState>
        )}
        {queue.length > 0 && (
          <div className={styles.queue}>
            <QueueHeading />
            <MotionList items={shown} keyOf={(item) => item.key} className={styles.rows}>
              {(item) => item.row(item.key === oldestKey)}
            </MotionList>
          </div>
        )}
      </section>

      {(isAdmin(user) || hasResponsibility(user, 'supw')) && (
        <Card className="stack-tight">
          <h3>SUPW records</h3>
          <p className="meta">Every student's confirmed hours, for the school's records.</p>
          <SupwExportButton />
        </Card>
      )}
    </div>
  );
}
