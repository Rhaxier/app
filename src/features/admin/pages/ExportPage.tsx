// Admin > System > Data export. Downloads a CSV file per area. Each comes from
// an admin-only database function, and the file is made in the browser:
//   users         admin_list_users()
//   SUPW hours    supw_hours_report() (also open to the SUPW coordinator)
//   bookings      admin_export_bookings(from, to)
//   reports       admin_export_reports(from, to)
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FieldRow, FormError, TextField } from '@/components/Input';
import { addDaysToKey, dayKey, formatDateTime } from '@/lib/dates';
import { downloadCsv, toCsv } from '@/lib/csv';
import { errorMessage } from '@/lib/errors';
import { roleLabel } from '@/lib/status';
import { exportBookings, exportReports, fetchUsers } from '../api';
import { AdminPage } from '../components/AdminPage';
import { SupwExportButton } from '../components/SupwExportButton';
import styles from './ListPage.module.css';

const when = (value: string | null) => (value ? formatDateTime(value) : '');

export function ExportPage() {
  const [from, setFrom] = useState(addDaysToKey(dayKey(), -90));
  const [to, setTo] = useState(dayKey());

  return (
    <AdminPage title="Data export" description="Download a CSV file to open in a spreadsheet.">
      <ExportCard
        title="Users"
        description="Everyone, with role, grade, section, responsibilities and status."
        run={async () => {
          const users = await fetchUsers();
          downloadCsv(
            `users-${dayKey()}.csv`,
            toCsv(users, [
              { header: 'Name', value: (u) => u.full_name },
              { header: 'Email', value: (u) => u.email },
              { header: 'Role', value: (u) => roleLabel[u.role] },
              { header: 'Grade', value: (u) => u.grade },
              { header: 'Section', value: (u) => u.section },
              { header: 'Responsibilities', value: (u) => u.responsibilities.join(' ') },
              { header: 'Posting paused until', value: (u) => when(u.posting_suspended_until) },
              { header: 'Left', value: (u) => when(u.archived_at) },
            ]),
          );
        }}
      />

      <Card className="stack-tight">
        <h2 className={styles.cardTitle}>SUPW hours</h2>
        <p className="meta">Every student's confirmed hours and events attended.</p>
        <SupwExportButton />
      </Card>

      <Card className="stack-tight">
        <h2 className={styles.cardTitle}>Bookings and fix-it reports: dates</h2>
        <FieldRow>
          <TextField
            label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </FieldRow>
      </Card>

      <ExportCard
        title="Venue bookings"
        description="Every booking in those dates, with who asked, the decision and why."
        run={async () => {
          const rows = await exportBookings(from, to);
          downloadCsv(
            `bookings-${from}-to-${to}.csv`,
            toCsv(rows, [
              { header: 'Venue', value: (r) => r.venue },
              { header: 'Title', value: (r) => r.title },
              { header: 'Requested by', value: (r) => r.requested_by },
              { header: 'Supervising teacher', value: (r) => r.supervising_teacher },
              { header: 'Starts', value: (r) => when(r.starts_at) },
              { header: 'Ends', value: (r) => when(r.ends_at) },
              { header: 'Status', value: (r) => r.status },
              { header: 'Reviewed by', value: (r) => r.reviewed_by },
              { header: 'Review note', value: (r) => r.review_note },
              { header: 'Requested', value: (r) => when(r.requested_at) },
            ]),
          );
        }}
      />

      <ExportCard
        title="Fix-it reports"
        description="Every report made in those dates, with its status and who handled it."
        run={async () => {
          const rows = await exportReports(from, to);
          downloadCsv(
            `fixit-reports-${from}-to-${to}.csv`,
            toCsv(rows, [
              { header: 'Reported', value: (r) => when(r.reported_at) },
              { header: 'Category', value: (r) => r.category },
              { header: 'Room', value: (r) => r.room },
              { header: 'Description', value: (r) => r.description },
              { header: 'Status', value: (r) => r.status },
              { header: 'Urgent', value: (r) => (r.urgent ? 'yes' : '') },
              { header: 'Me too', value: (r) => r.me_too },
              { header: 'Reported by', value: (r) => r.reported_by },
              { header: 'Assigned to', value: (r) => r.assigned_to },
              { header: 'Resolved', value: (r) => when(r.resolved_at) },
            ]),
          );
        }}
      />
    </AdminPage>
  );
}

/** One download: a title, what's in it, and the button (with its own busy and error state). */
function ExportCard({
  title,
  description,
  run,
}: {
  title: string;
  description: string;
  run: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (problem) {
      setError(problem);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="stack-tight">
      <h2 className={styles.cardTitle}>{title}</h2>
      <p className="meta">{description}</p>
      <Button variant="secondary" icon="download" loading={busy} onClick={download}>
        Download CSV
      </Button>
      <FormError message={error ? errorMessage(error) : null} />
    </Card>
  );
}
