// The directions panel at the bottom of the indoor map, above the tab bar.
//
// Two sizes, like the card in a phone's maps app:
//   * collapsed (the default once there is a route): time, distance, the
//     step to do now, and Previous / Next. Small, so the route line stays in
//     view. Tap the handle (or the time) to see everything.
//   * expanded: where from and where to, swap, the step-free switch, and the
//     full list of steps.
// While the two ends are still being chosen it is always expanded.
//
// From: the student says where they are, by dropping the "I'm here" pin or
// by naming the room they're nearest. There is no live positioning, and
// nothing here suggests there is. When there is no route, the router's own
// message says why.
import { Link } from 'react-router-dom';
import { ButtonLink } from '@/components/Button';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/States';
import { Switch } from '@/components/Switch';
import type { Destination } from '../nav/assignments';
import type { RouteResult } from '../nav/router';
import { floorLabel, formatDistance, formatDuration } from '../nav/routeView';
import type { FloorId } from '../nav/types';
import { DestinationSearch } from './DestinationSearch';
import styles from './DirectionsPanel.module.css';

export type StartChoice =
  { kind: 'place'; destination: Destination } | { kind: 'pin'; floor: FloorId };

interface DirectionsPanelProps {
  destinations: Destination[];
  start: StartChoice | null;
  destination: Destination | null;
  /** Waiting for a tap on the map to drop the pin. */
  tapping: boolean;
  /** Why the last pin drop was refused, if it was. */
  pinMessage: string | null;
  stepFree: boolean;
  result: RouteResult | null;
  stepIndex: number;
  isAdmin: boolean;
  /** Why this isn't the usual route (something out of order), if it isn't. */
  notice: string | null;
  /** Where "Report a problem here" goes for the destination, if there is one. */
  reportLink: string | null;
  /** Small: only time, distance and the current step (only when there is a route). */
  collapsed: boolean;
  onCollapsed: (collapsed: boolean) => void;
  onTapToStart: () => void;
  onPickStart: (destination: Destination) => void;
  onPickDestination: (destination: Destination) => void;
  onClearStart: () => void;
  onClearDestination: () => void;
  onSwap: () => void;
  onStepFree: (stepFree: boolean) => void;
  onStep: (index: number) => void;
  onClose: () => void;
}

export function DirectionsPanel(props: DirectionsPanelProps) {
  const { start, destination, result, stepIndex } = props;
  const route = result?.ok && result.steps.length > 0 ? result : null;
  const small = props.collapsed && route !== null;

  // The grab bar at the top: the way to change size.
  const handle = route && (
    <button
      type="button"
      className={styles.handle}
      aria-expanded={!small}
      aria-label={small ? 'Show all directions' : 'Show less'}
      onClick={() => props.onCollapsed(!small)}
    >
      <span className={styles.grip} aria-hidden="true" />
    </button>
  );

  const closeButton = (
    <button
      type="button"
      className={styles.iconButton}
      aria-label="Close directions"
      onClick={props.onClose}
    >
      <Icon name="close" size={18} />
    </button>
  );

  const noticeLine = props.notice && (
    <p className={styles.notice} role="status">
      {props.notice}
    </p>
  );

  const stepControls = route && (
    <div className={small ? styles.stepSmall : styles.step}>
      <div className={styles.stepWords}>
        <span className="meta">
          Step {stepIndex + 1} of {route.steps.length} · {floorLabel(route.steps[stepIndex].floor)}
        </span>
        <p className={styles.stepText}>{route.steps[stepIndex].text}</p>
      </div>
      <div className={styles.stepButtons}>
        <Button
          size="small"
          variant="secondary"
          disabled={stepIndex === 0}
          onClick={() => props.onStep(stepIndex - 1)}
        >
          Previous
        </Button>
        <Button
          size="small"
          disabled={stepIndex >= route.steps.length - 1}
          onClick={() => props.onStep(stepIndex + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );

  if (small && route) {
    return (
      <section className={`glass thick ${styles.panel} ${styles.small}`} aria-label="Directions">
        {handle}
        <div className={styles.header}>
          <button
            type="button"
            className={styles.summaryButton}
            onClick={() => props.onCollapsed(false)}
          >
            <strong>{formatDuration(route.durationS)}</strong>
            <span className="meta">
              {formatDistance(route.distanceM)} to {destination?.name ?? 'your destination'}
            </span>
          </button>
          {closeButton}
        </div>
        {noticeLine}
        <div aria-live="polite">{stepControls}</div>
      </section>
    );
  }

  const canSwap = start?.kind === 'place' && destination !== null;

  return (
    <section className={`glass thick ${styles.panel}`} aria-label="Directions">
      {handle}
      <div className={styles.header}>
        <h2 className={styles.title}>Directions</h2>
        {closeButton}
      </div>

      <div className={styles.ends}>
        <div className={styles.end}>
          <span className={styles.endLabel}>From</span>
          {start ? (
            <span className={styles.endValue}>
              {start.kind === 'pin'
                ? `Your pin, ${floorLabel(start.floor).toLowerCase()}`
                : start.destination.name}
              <button type="button" className={styles.change} onClick={props.onClearStart}>
                Change
              </button>
            </span>
          ) : (
            <div className="stack-tight">
              <span className="meta">Where are you?</span>
              <Button
                size="small"
                variant={props.tapping ? 'primary' : 'secondary'}
                icon="pin"
                aria-pressed={props.tapping}
                onClick={props.onTapToStart}
              >
                {props.tapping ? 'Now tap the map where you are' : 'Drop a pin on the map'}
              </Button>
              <DestinationSearch
                destinations={props.destinations}
                label="Or the room you're nearest"
                plain
                onPick={props.onPickStart}
              />
              {props.pinMessage && (
                <p className={styles.problem} role="alert">
                  {props.pinMessage}
                </p>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className={styles.iconButton}
          aria-label="Swap start and destination"
          disabled={!canSwap}
          title={canSwap ? undefined : 'Pick a room to start from to swap'}
          onClick={props.onSwap}
        >
          <Icon name="swap" size={18} />
        </button>

        <div className={styles.end}>
          <span className={styles.endLabel}>To</span>
          {destination ? (
            <>
              <span className={styles.endValue}>
                {destination.name}
                <button type="button" className={styles.change} onClick={props.onClearDestination}>
                  Change
                </button>
              </span>
              {props.reportLink && (
                <ButtonLink to={props.reportLink} variant="quiet" size="small" icon="wrench">
                  Report a problem here
                </ButtonLink>
              )}
            </>
          ) : (
            <DestinationSearch
              destinations={props.destinations}
              label="Where to?"
              plain
              onPick={props.onPickDestination}
            />
          )}
        </div>
      </div>

      <Switch
        label="Step-free route"
        hint="Uses lifts and ramps only, no stairs."
        checked={props.stepFree}
        onChange={props.onStepFree}
      />

      {noticeLine}

      {route && (
        <div className="stack-tight" aria-live="polite">
          <p className={styles.summary}>
            <strong>{formatDistance(route.distanceM)}</strong> · {formatDuration(route.durationS)}
          </p>
          {stepControls}
          <details className={styles.all}>
            <summary>All steps</summary>
            <ol className={styles.steps}>
              {route.steps.map((step, index) => (
                <li key={index}>
                  <button
                    type="button"
                    className={styles.stepButton}
                    aria-current={index === stepIndex ? 'step' : undefined}
                    onClick={() => props.onStep(index)}
                  >
                    {step.text}
                  </button>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}

      {result && !result.ok && (
        <EmptyState icon="map" title={result.message}>
          {result.code === 'no-step-free-route' && (
            <Button size="small" variant="secondary" onClick={() => props.onStepFree(false)}>
              Show route with stairs
            </Button>
          )}
          {result.code === 'floors-not-connected' && props.isAdmin && (
            <Link to="/admin/map-rooms?tab=connectors">Add stairs or a lift</Link>
          )}
        </EmptyState>
      )}
    </section>
  );
}
