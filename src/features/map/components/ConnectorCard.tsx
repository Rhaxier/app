// The card for a lift or staircase tapped on the indoor map: what it is,
// which floors it serves, whether it is in service, and "Report a problem"
// for everyone. Staff allowed to (admins and the teams fix-it reports go to;
// the database checks again) also get "Mark out of order" / "Back in
// service", which reroutes every open map straight away.
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { errorMessage } from '@/lib/errors';
import { useCanMarkOutOfOrder, useSetAvailable } from '../nav/hooks';
import { floorLabel } from '../nav/routeView';
import type { Connector, FloorId } from '../nav/types';
import styles from './DirectionsPanel.module.css';

interface ConnectorCardProps {
  connector: Connector;
  floor: FloorId;
  onClose: () => void;
}

export function ConnectorCard({ connector, floor, onClose }: ConnectorCardProps) {
  const canMark = useCanMarkOutOfOrder().data ?? false;
  const setAvailable = useSetAvailable();
  const [confirm, setConfirm] = useState(false);
  const kind = connector.type === 'lift' ? 'Lift' : 'Stairs';
  const floors = connector.floors.join(', ');
  const reportLink = `/map/report?target=${encodeURIComponent(`connector:${connector.id}`)}&floor=${encodeURIComponent(floor)}`;

  return (
    <section className={`glass thick ${styles.panel} ${styles.small}`} aria-label={connector.name}>
      <div className={styles.header}>
        <div className="stack-tight">
          <h2 className={styles.title}>{connector.name}</h2>
          <span className="meta">
            {kind} · floors {floors}
            {connector.accessible ? ' · step-free' : ''}
          </span>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Close ${connector.name}`}
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className={connector.available ? undefined : styles.problem} role="status">
        {connector.available
          ? 'In service.'
          : 'Out of order. Routes go another way until it is fixed.'}
      </p>
      <div className="row-wrap">
        <ButtonLink to={reportLink} variant="secondary" size="small" icon="wrench">
          Report a problem
        </ButtonLink>
        {canMark && (
          <Button
            size="small"
            variant={connector.available ? 'secondary' : 'primary'}
            onClick={() => setConfirm(true)}
          >
            {connector.available ? 'Mark out of order' : 'Back in service'}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title={
          connector.available
            ? `Mark ${connector.name} out of order?`
            : `Mark ${connector.name} as working again?`
        }
        confirmLabel={connector.available ? 'Mark out of order' : 'Back in service'}
        tone={connector.available ? 'alert' : 'primary'}
        busy={setAvailable.isPending}
        error={setAvailable.isError ? errorMessage(setAvailable.error) : null}
        onConfirm={() =>
          setAvailable.mutate(
            { kind: 'connector', id: connector.id, available: !connector.available },
            { onSuccess: () => setConfirm(false) },
          )
        }
        onClose={() => setConfirm(false)}
      >
        <p>
          {connector.available
            ? `Routes stop using it straight away, on every open map. ${floorLabel(floor)} and the other floors it serves are affected.`
            : 'Routes can use it again straight away.'}
        </p>
      </ConfirmDialog>
    </section>
  );
}
