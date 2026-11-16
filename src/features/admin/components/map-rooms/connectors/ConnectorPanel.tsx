// The side panel for the selected staircase or lift: name, floors served,
// position on this floor, step-free and in-service switches, delete.
//
// Every change goes into the editor's draft, except "Available": that one is
// saved at once (map_set_available), because marking a lift out of order
// must work fast from a phone. A connector that has never been saved can't
// be marked yet, so for it the switch only changes the draft.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CheckboxField, FieldRow, TextField } from '@/components/Input';
import { Switch } from '@/components/Switch';
import type { Connector, FloorId, Geometry, Point } from '@/features/map/nav/types';
import { footnotes } from '../../../strings';
import { floorLabel } from '../labels';
import styles from './Connectors.module.css';

interface ConnectorPanelProps {
  connector: Connector;
  geometry: Geometry;
  floor: FloorId;
  /** True when the connector exists in the database (so Available can be saved at once). */
  saved: boolean;
  /** Focus the name field (a connector that was just placed). */
  focusName: boolean;
  availableBusy: boolean;
  onRename: (name: string) => void;
  onFloors: (floors: FloorId[]) => void;
  onMove: (point: Point) => void;
  onAccessible: (accessible: boolean) => void;
  onAvailable: (available: boolean) => void;
  onShowFloor: (floor: FloorId) => void;
  onDelete: () => void;
}

export function ConnectorPanel({
  connector,
  geometry,
  floor,
  saved,
  focusName,
  availableBusy,
  onRename,
  onFloors,
  onMove,
  onAccessible,
  onAvailable,
  onShowFloor,
  onDelete,
}: ConnectorPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const position = connector.floors.includes(floor) ? connector.positions[floor] : undefined;

  return (
    <section className="stack" aria-label={`${connector.name || 'Unnamed'} settings`}>
      <TextField
        label="Name"
        // A connector just placed: the name is ready to type over ("Stairs 1").
        autoFocus={focusName}
        onFocus={(event) => focusName && event.target.select()}
        maxLength={60}
        value={connector.name}
        onChange={(event) => onRename(event.target.value)}
        error={
          connector.name.trim() === '' ? 'Give it a name, for example “West stairs”.' : undefined
        }
      />
      <p className="meta">Type: {connector.type === 'lift' ? 'Lift' : 'Stairs'}</p>

      <fieldset className={styles.fieldset}>
        <legend>Floors served</legend>
        <p className="meta">{footnotes.mapRooms.floorsServed}</p>
        {geometry.floors.map((f) => {
          const served = connector.floors.includes(f.id);
          const placed = served && Boolean(connector.positions[f.id]);
          return (
            <div key={f.id} className={styles.floorRow}>
              <CheckboxField
                label={floorLabel(f.id)}
                checked={served}
                onChange={(event) =>
                  onFloors(
                    event.target.checked
                      ? [...connector.floors, f.id]
                      : connector.floors.filter((x) => x !== f.id),
                  )
                }
              />
              <span className={placed ? styles.set : styles.notSet}>
                {served ? (placed ? 'Set' : 'Not set') : ''}
              </span>
              <Button
                variant="quiet"
                size="small"
                disabled={f.id === floor}
                aria-label={`Show ${floorLabel(f.id)}`}
                onClick={() => onShowFloor(f.id)}
              >
                Show
              </Button>
            </div>
          );
        })}
      </fieldset>

      {position ? (
        <FieldRow>
          <TextField
            label={`X on ${floorLabel(floor)}`}
            type="number"
            inputMode="numeric"
            value={Math.round(position.x)}
            onChange={(event) => {
              const x = Number(event.target.value);
              if (Number.isFinite(x)) onMove({ x, y: position.y });
            }}
          />
          <TextField
            label={`Y on ${floorLabel(floor)}`}
            type="number"
            inputMode="numeric"
            hint={footnotes.mapRooms.position}
            value={Math.round(position.y)}
            onChange={(event) => {
              const y = Number(event.target.value);
              if (Number.isFinite(y)) onMove({ x: position.x, y });
            }}
          />
        </FieldRow>
      ) : (
        <p className="meta">Not on {floorLabel(floor)}. Tick it above to place it here.</p>
      )}

      <Switch
        label="Accessible (step-free)"
        hint={footnotes.mapRooms.accessible}
        checked={connector.accessible}
        onChange={onAccessible}
      />
      <Switch
        label="Available"
        hint={
          saved
            ? footnotes.mapRooms.available
            : 'Turn off when it is out of order. Saved with the rest once you press Save.'
        }
        checked={connector.available}
        disabled={availableBusy}
        onChange={onAvailable}
      />

      <Button variant="quiet" icon="trash" onClick={() => setConfirmDelete(true)}>
        Delete
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${connector.name || 'this one'}?`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
        onClose={() => setConfirmDelete(false)}
      >
        <p>
          Delete {connector.name || 'it'}? Routes that use it will change, and floors may stop being
          connected.
        </p>
        <p className="meta">
          It is removed from your unsaved changes; press Save to make it final.
        </p>
      </ConfirmDialog>
    </section>
  );
}
