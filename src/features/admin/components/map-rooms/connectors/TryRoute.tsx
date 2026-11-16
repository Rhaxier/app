// "Try a route": pick two places and see what the router does with the
// stairs and lifts as they are in the editor, unsaved changes included.
// This is how an admin checks their work before saving.
import { useMemo, useState } from 'react';
import { SelectField } from '@/components/Input';
import { Switch } from '@/components/Switch';
import type { Destination } from '@/features/map/nav/assignments';
import type { RouteEnd, RouteMode, RouteResult } from '@/features/map/nav/router';
import { destinationEnd } from '@/features/map/nav/routeEnds';
import { footnotes } from '../../../strings';
import { floorLabel } from '../labels';
import styles from './Connectors.module.css';

interface TryRouteProps {
  destinations: Destination[];
  /** Routes on the editor's draft. */
  route: (from: RouteEnd, to: RouteEnd, mode: RouteMode) => RouteResult;
  /** Changes whenever the draft does, so the result is worked out again. */
  draftVersion: number;
  /** Names by connector id: a route lists the ids of the stairs and lifts it uses. */
  connectorNames: Record<string, string>;
}

export function TryRoute({ destinations, route, draftVersion, connectorNames }: TryRouteProps) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [stepFree, setStepFree] = useState(false);
  const sorted = useMemo(
    () => [...destinations].sort((a, b) => a.name.localeCompare(b.name)),
    [destinations],
  );
  const from = sorted.find((d) => d.roomId === fromId);
  const to = sorted.find((d) => d.roomId === toId);

  const result = useMemo(
    () =>
      from && to
        ? route(destinationEnd(from), destinationEnd(to), stepFree ? 'step-free' : 'standard')
        : null,
    // draftVersion: the draft router changed, so the same two places may route differently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, to, stepFree, draftVersion],
  );

  const options = sorted.map((d) => (
    <option key={d.roomId} value={d.roomId}>
      {d.name} ({floorLabel(d.floor)})
    </option>
  ));

  return (
    <section className="stack-tight" aria-label="Try a route">
      <h3 className={styles.heading}>Try a route</h3>
      <p className="meta">{footnotes.mapRooms.tryRoute}</p>
      <SelectField label="From" value={fromId} onChange={(event) => setFromId(event.target.value)}>
        <option value="">Choose a place</option>
        {options}
      </SelectField>
      <SelectField label="To" value={toId} onChange={(event) => setToId(event.target.value)}>
        <option value="">Choose a place</option>
        {options}
      </SelectField>
      <Switch label="Step-free route" checked={stepFree} onChange={setStepFree} />
      <div aria-live="polite">
        {result &&
          (result.ok ? (
            <div className="stack-tight">
              <p>
                <strong>
                  {Math.round(result.distanceM)} m, about{' '}
                  {Math.max(1, Math.round(result.durationS / 60))} min
                </strong>
                {result.connectors.length > 0 &&
                  ` · via ${result.connectors.map((id) => connectorNames[id] ?? id).join(', ')}`}
              </p>
              <ol className={styles.steps}>
                {result.steps.map((step, index) => (
                  <li key={index}>{step.text}</li>
                ))}
              </ol>
            </div>
          ) : (
            <p className={styles.routeError}>{result.message}</p>
          ))}
      </div>
    </section>
  );
}
