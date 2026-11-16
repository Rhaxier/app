// The directions panel at the bottom of the indoor map, above the tab bar.
//
// From: the student says where they are, either by dropping the "I'm here"
// pin on the map or by naming the classroom they're nearest. There is no
// live positioning, and nothing here suggests there is.
// To: the destination from the search. Swap turns the trip round.
// Then the route: distance and time, the current step with Previous and
// Next (the map follows to the step's floor), and every step in a list.
// When there is no route, the router's own message says why.
import { Link } from 'react-router-dom';
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
  const canSwap = start?.kind === 'place' && destination !== null;

  return (
    <section className={`glass thick ${styles.panel}`} aria-label="Directions">
      <div className={styles.header}>
        <h2 className={styles.title}>Directions</h2>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Close directions"
          onClick={props.onClose}
        >
          <Icon name="close" size={18} />
        </button>
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
                dropUp
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
            <span className={styles.endValue}>
              {destination.name}
              <button type="button" className={styles.change} onClick={props.onClearDestination}>
                Change
              </button>
            </span>
          ) : (
            <DestinationSearch
              destinations={props.destinations}
              label="Where to?"
              plain
              dropUp
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

      {result && result.ok && result.steps.length > 0 && (
        <div className="stack-tight" aria-live="polite">
          <p className={styles.summary}>
            <strong>{formatDistance(result.distanceM)}</strong> · {formatDuration(result.durationS)}
          </p>
          <div className={styles.step}>
            <span className="meta">
              Step {stepIndex + 1} of {result.steps.length}
              {` · ${floorLabel(result.steps[stepIndex].floor)}`}
            </span>
            <p className={styles.stepText}>{result.steps[stepIndex].text}</p>
            <div className="row">
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
                disabled={stepIndex >= result.steps.length - 1}
                onClick={() => props.onStep(stepIndex + 1)}
              >
                Next
              </Button>
            </div>
          </div>
          <details className={styles.all}>
            <summary>All steps</summary>
            <ol className={styles.steps}>
              {result.steps.map((step, index) => (
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
