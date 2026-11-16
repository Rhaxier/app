// Map and rooms > Stairs and lifts, for now: how many are placed and what
// that means for routes, straight from the router's own checks
// (router.problems()). Placing and editing them is the next step of the
// indoor map work (MAP_NOTES.md).
import { useMemo } from 'react';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { ErrorState, LoadingState } from '@/components/States';
import { useNavRouter } from '@/features/map/nav/routerContext';

// The router's problems are errors (Save will be blocked) or warnings.
const severityLook = {
  error: { label: 'Problem', tone: 'fix' },
  warning: { label: 'Warning', tone: 'attention' },
} as const;

export function ConnectorStatus() {
  const { router, ready, version, connectors, error } = useNavRouter();
  // `version` changes whenever the router is given new stairs or lifts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const problems = useMemo(() => router?.problems() ?? [], [router, version]);

  if (error) return <ErrorState error={error} />;
  if (!ready) return <LoadingState label="Loading the map…" />;

  const errors = problems.filter((p) => p.severity === 'error');
  const warnings = problems.filter((p) => p.severity === 'warning');
  const allConnected = problems.length === 0;

  return (
    <Card className="stack-tight">
      <p>
        <strong>
          {connectors.length === 0
            ? 'No stairs or lifts placed yet.'
            : `${connectors.length} ${connectors.length === 1 ? 'staircase or lift' : 'stairs and lifts'} placed.`}
        </strong>{' '}
        {allConnected
          ? 'All floors are connected.'
          : 'Routes can’t go between floors that aren’t connected.'}
      </p>
      {[...errors, ...warnings].length > 0 && (
        <ul className="stack-tight">
          {[...errors, ...warnings].map((problem, index) => (
            <li key={index} className="row">
              <StatusBadge map={severityLook} status={problem.severity} />
              <span>{problem.message}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="meta">Placing stairs and lifts isn’t available in this version yet.</p>
    </Card>
  );
}
