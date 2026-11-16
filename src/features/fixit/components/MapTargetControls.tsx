// On a fix-it report that names a lift, staircase or door: what it is, whether
// it is in service now, and, for the staff allowed to (admins and the teams
// fix-it reports go to; the database checks again: map_set_available),
// "Mark out of order" / "Back in service". Every open map reroutes at once.
//
// When the report is resolved while its lift or door is still out of order,
// it asks whether to put it back in service, and says if other open reports
// name the same one (perhaps it isn't fixed for them).
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  useCanMarkOutOfOrder,
  useConnectors,
  useOverrides,
  useSetAvailable,
} from '@/features/map/nav/hooks';
import { errorMessage } from '@/lib/errors';
import type { Report } from '../api';
import { isOpen } from '../logic';

interface MapTargetControlsProps {
  report: Report;
  /** Every report the viewer can see, to count others about the same target. */
  allReports: Report[];
  /** Goes up each time this report is saved as resolved (asks about service). */
  resolvedSeq: number;
}

export function MapTargetControls({ report, allReports, resolvedSeq }: MapTargetControlsProps) {
  const canMark = useCanMarkOutOfOrder().data ?? false;
  const connectors = useConnectors();
  const overrides = useOverrides();
  const setAvailable = useSetAvailable();
  const [confirm, setConfirm] = useState<'out' | 'back' | null>(null);
  const [seenSeq, setSeenSeq] = useState(resolvedSeq);

  const kind = report.map_target_kind;
  const id = report.map_target_id;
  const connector = kind === 'connector' ? connectors.data?.find((c) => c.id === id) : undefined;
  const available =
    kind === 'connector'
      ? (connector?.available ?? true)
      : overrides.data?.doorAvailable[id ?? ''] !== false;
  const gone = kind === 'connector' && connectors.data !== undefined && !connector;
  const name =
    kind === 'connector'
      ? (connector?.name ?? report.map_target_name ?? 'A lift or staircase')
      : `Door ${id}`;
  const others = allReports.filter(
    (r) =>
      r.id !== report.id &&
      isOpen(r.status) &&
      r.map_target_kind === kind &&
      r.map_target_id === id,
  ).length;

  // Just resolved, and what it was about is still out of order: ask.
  if (resolvedSeq !== seenSeq) {
    setSeenSeq(resolvedSeq);
    if (canMark && !available && !gone) setConfirm('back');
  }

  if (!kind || !id) return null;

  function apply(next: boolean) {
    if (!kind || !id) return;
    setAvailable.mutate({ kind, id, available: next }, { onSuccess: () => setConfirm(null) });
  }

  return (
    <div className="stack-tight">
      <p>
        About: <strong>{name}</strong>
        {gone ? ' (no longer on the map)' : available ? ' · in service' : ' · marked out of order'}
      </p>
      {canMark && !gone && (
        <Button
          variant={available ? 'secondary' : 'primary'}
          size="small"
          onClick={() => setConfirm(available ? 'out' : 'back')}
        >
          {available ? 'Mark out of order' : 'Back in service'}
        </Button>
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'out' ? `Mark ${name} out of order?` : `Mark ${name} as working again?`}
        confirmLabel={confirm === 'out' ? 'Mark out of order' : 'Back in service'}
        tone={confirm === 'out' ? 'alert' : 'primary'}
        busy={setAvailable.isPending}
        error={setAvailable.isError ? errorMessage(setAvailable.error) : null}
        onConfirm={() => apply(confirm !== 'out')}
        onClose={() => setConfirm(null)}
      >
        <p>
          {confirm === 'out'
            ? 'Routes stop using it straight away, on every open map.'
            : 'Routes can use it again straight away.'}
        </p>
        {confirm === 'back' && others > 0 && (
          <p>
            {others === 1
              ? '1 other open report is also about it.'
              : `${others} other open reports are also about it.`}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
