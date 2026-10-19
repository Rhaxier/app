// Approvals (staff only): one queue of everything waiting on this person.
//   * student volunteering events to approve      (any teacher or admin)
//   * venue requests                              (venues staff and admins)
//   * student bookings you were asked to supervise
//   * fix-it reports routed to your team          (facilities / IT staff)
//   * SUPW hours to confirm                       (see can_confirm_hours)
//   * content people reported                     (all staff)
// Each section reuses the feature's own hooks and actions; this page only
// gathers them. The student screens are unchanged: this is added on top.
import { ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, LoadingState } from '@/components/States';
import { SupwExportButton } from '@/features/admin/components/SupwExportButton';
import { useContentReports } from '@/features/admin/hooks';
import { useCurrentUser } from '@/features/auth/hooks';
import { useReports } from '@/features/fixit/hooks';
import { isOpen } from '@/features/fixit/logic';
import { BookingCard } from '@/features/venues/components/BookingCard';
import { ReviewActions } from '@/features/venues/components/ReviewActions';
import { SupervisorActions } from '@/features/venues/components/SupervisorActions';
import { useLiveBookings, usePendingForReview, useToSupervise } from '@/features/venues/hooks';
import { useEvents, useHoursToConfirm } from '@/features/volunteering/hooks';
import { canReviewVenues, hasResponsibility, isAdmin } from '@/lib/permissions';
import { ContentReportCard } from '../components/ContentReportCard';
import { EventApprovalCard } from '../components/EventApprovalCard';
import { HoursCard } from '../components/HoursCard';
import { ReportQueueCard } from '../components/ReportQueueCard';
import { Section } from '../components/Section';

export function ApprovalsPage() {
  const user = useCurrentUser();
  const reviewsVenues = canReviewVenues(user);
  const events = useEvents();
  const venueRequests = usePendingForReview(reviewsVenues);
  const toSupervise = useToSupervise(user.id);
  const reports = useReports();
  const hours = useHoursToConfirm();
  const contentReports = useContentReports();
  useLiveBookings();

  const eventsToApprove = (events.data ?? []).filter(
    (event) => event.status === 'awaiting_approval' && event.creator_id !== user.id,
  );
  const routedReports = (reports.data ?? []).filter(
    (report) => isOpen(report.status) && user.responsibilities.includes(report.routed_to),
  );
  const openContent = (contentReports.data ?? []).filter((report) => report.status === 'open');

  const counts = [
    eventsToApprove.length,
    reviewsVenues ? (venueRequests.data?.length ?? 0) : 0,
    toSupervise.data?.length ?? 0,
    routedReports.length,
    hours.data?.length ?? 0,
    openContent.length,
  ];
  const total = counts.reduce((sum, n) => sum + n, 0);
  const loading = [events, toSupervise, reports, hours, contentReports].some(
    (query) => query.isPending,
  );

  return (
    <div className="stack">
      <PageHeader
        title="Approvals"
        subtitle={total > 0 ? `${total} waiting on you` : 'Everything waiting on you'}
        action={
          isAdmin(user) && (
            <ButtonLink to="/admin" variant="secondary" size="small" icon="shield">
              Admin
            </ButtonLink>
          )
        }
      />

      {loading && <LoadingState />}
      {!loading && total === 0 && (
        <EmptyState icon="check" title="Nothing waiting for you">
          New requests, reports and approvals will appear here.
        </EmptyState>
      )}

      <Section id="q-events" title="Student events to approve" count={counts[0]}>
        {eventsToApprove.map((event) => (
          <EventApprovalCard key={event.id} event={event} />
        ))}
      </Section>

      <Section id="q-venues" title="Venue requests" count={counts[1]}>
        <p className="meta">Soonest first. Approving one rejects any request it overlaps.</p>
        {venueRequests.data?.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            showRequester
            actions={<ReviewActions booking={booking} />}
          />
        ))}
      </Section>

      <Section id="q-supervise" title="Bookings to supervise" count={counts[2]}>
        {toSupervise.data?.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            showRequester
            actions={<SupervisorActions booking={booking} />}
          />
        ))}
      </Section>

      <Section id="q-reports" title="Fix-it reports for your team" count={counts[3]}>
        {routedReports.map((report) => (
          <ReportQueueCard key={report.id} report={report} />
        ))}
      </Section>

      <Section id="q-hours" title="SUPW hours to confirm" count={counts[4]}>
        {hours.data?.map((item) => (
          <HoursCard key={item.signup_id} item={item} />
        ))}
      </Section>

      <Section id="q-content" title="Reported content" count={counts[5]}>
        {openContent.map((report) => (
          <ContentReportCard key={report.id} report={report} />
        ))}
      </Section>

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
