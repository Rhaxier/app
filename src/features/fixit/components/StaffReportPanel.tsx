// Staff tools on a report. Any teacher can mark it urgent. The team it was
// routed to (or an admin) can acknowledge, progress, resolve, mark it as a
// duplicate or "won't fix", add a note and assign someone. Each status change
// notifies the reporter and everyone who said "me too".
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError, SelectField, TextArea } from '@/components/Input';
import { Switch } from '@/components/Switch';
import { useCurrentUser } from '@/features/auth/hooks';
import { useStaff } from '@/features/people/hooks';
import { errorMessage } from '@/lib/errors';
import { canManageReport } from '@/lib/permissions';
import type { Report, ReportStatus } from '../api';
import { useReports, useUpdateReport } from '../hooks';
import { isOpen, reportTitle, staffStatusOptions } from '../logic';

export function StaffReportPanel({ report }: { report: Report }) {
  const user = useCurrentUser();
  const update = useUpdateReport(report.id);
  const staff = useStaff();
  const others = useReports();
  const manage = canManageReport(user, report.routed_to);
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [note, setNote] = useState(report.status_note ?? '');
  const [assignedTo, setAssignedTo] = useState(report.assigned_to ?? '');
  const [duplicateOf, setDuplicateOf] = useState(report.duplicate_of ?? '');

  const candidates = (others.data ?? []).filter((r) => r.id !== report.id && isOpen(r.status));

  function save() {
    update.mutate({
      status,
      status_note: note.trim() || null,
      assigned_to: assignedTo || null,
      duplicate_of: status === 'duplicate' ? duplicateOf || null : null,
    });
  }

  return (
    <Card className="stack-tight">
      <h3>Staff</h3>
      <Switch
        label="Urgent"
        hint="Emails the responsible team straight away."
        checked={report.urgent}
        disabled={update.isPending}
        onChange={(urgent) => update.mutate({ urgent })}
      />
      {manage ? (
        <>
          <SelectField
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ReportStatus)}
          >
            <option value="open">Open</option>
            {staffStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          {status === 'duplicate' && (
            <SelectField
              label="Duplicate of"
              value={duplicateOf}
              onChange={(e) => setDuplicateOf(e.target.value)}
            >
              <option value="">Choose the original report…</option>
              {candidates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.room_code ? `${r.room_code} · ` : ''}
                  {reportTitle(r.description, 40)}
                </option>
              ))}
            </SelectField>
          )}
          <TextArea
            label="Note for the reporter (optional)"
            hint="Shown with the status update."
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <SelectField
            label="Assigned to"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">Nobody yet</option>
            {staff.data?.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </SelectField>
          <Button
            loading={update.isPending}
            disabled={status === 'duplicate' && !duplicateOf}
            onClick={save}
          >
            Save and notify
          </Button>
        </>
      ) : (
        <p className="meta">Only the team this report was sent to can change its status.</p>
      )}
      <FormError message={update.isError ? errorMessage(update.error) : null} />
    </Card>
  );
}
