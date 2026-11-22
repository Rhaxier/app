// Map and rooms > Stairs and lifts: the editor where an admin places the real
// stairs and lifts (spec: MAP_NOTES.md, section 5(b)).
//
// How it works:
//   * Edits go into a draft (a list of Connector in React state). Nothing
//     reaches students until Save, which sends the whole list in one go
//     (map_save_connectors). Save is blocked while any check is red.
//   * Every change, even each step of a drag, is checked again with the
//     same linking code the router uses (checkDraft, well under a
//     millisecond), so the markers and the checks panel are always current.
//   * "Try a route" runs on a second router that holds the draft, so the
//     admin sees the effect before saving.
//   * The one exception to the draft: Available is saved at once.
//   * While nothing is unsaved, the draft follows the saved list, so another
//     admin's save (Realtime) shows up here. With unsaved changes it doesn't
//     overwrite them; a notice offers to load the saved version instead.
import { useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Sheet } from '@/components/Sheet';
import { ErrorState, LoadingState } from '@/components/States';
import { searchableDestinations } from '@/features/map/nav/assignments';
import { ConnectorMarkers } from '@/features/map/nav/components/ConnectorMarkers';
import { FloorPlanView } from '@/features/map/nav/components/FloorPlanView';
import {
  checkDraft,
  connectivitySummary,
  isDirty,
  moveConnector,
  newConnector,
  removeConnector,
  renameConnector,
  setAccessible,
  setAvailable,
  setFloorsServed,
} from '@/features/map/nav/connectorDraft';
import { indexGeometry } from '@/features/map/nav/graph';
import { useSaveConnectors, useSetAvailable } from '@/features/map/nav/hooks';
import { createRouter } from '@/features/map/nav/router';
import { useNavRouter } from '@/features/map/nav/routerContext';
import type { Connector, FloorId, Geometry, Point } from '@/features/map/nav/types';
import { errorMessage } from '@/lib/errors';
import { footnotes } from '../../../strings';
import { floorLabel } from '../labels';
import { ConnectorPanel } from './ConnectorPanel';
import styles from './Connectors.module.css';
import { TryRoute } from './TryRoute';
import { ValidationPanel } from './ValidationPanel';
import { useSideBySide } from '../useSideBySide';

type Tool = 'select' | 'stairs' | 'lift';

export function ConnectorsTab() {
  const { geometry, connectors, ready, error } = useNavRouter();
  if (error) return <ErrorState error={error} />;
  if (!ready || !geometry) return <LoadingState label="Loading the map…" />;
  return <Editor geometry={geometry} saved={connectors} />;
}

function Editor({ geometry, saved }: { geometry: Geometry; saved: Connector[] }) {
  const { assignments } = useNavRouter();
  const [measure, wide] = useSideBySide(880);
  const save = useSaveConnectors();
  const markAvailable = useSetAvailable();
  const index = useMemo(() => indexGeometry(geometry), [geometry]);

  const [draft, setDraft] = useState<Connector[]>(saved);
  // The saved list the draft is compared with (what Discard goes back to).
  const [base, setBase] = useState<Connector[]>(saved);
  const [lastSaved, setLastSaved] = useState(saved);
  const [savedElsewhere, setSavedElsewhere] = useState(false);
  const [floor, setFloor] = useState<FloorId>(geometry.floors[0]?.id ?? 'G');
  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; point: Point } | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // The saved list changed (our save, another admin's, Realtime). Adjusting
  // state while rendering is React's recommended way to follow a prop.
  if (saved !== lastSaved) {
    setLastSaved(saved);
    if (!isDirty(draft, base)) {
      setDraft(saved);
      setBase(saved);
    } else if (isDirty(base, saved)) {
      setSavedElsewhere(true);
    } else {
      setBase(saved);
    }
  }

  const dirty = isDirty(draft, base);
  const live = useMemo(
    () => (dragging ? moveConnector(draft, dragging.id, floor, dragging.point) : draft),
    [draft, dragging, floor],
  );
  const check = useMemo(() => checkDraft(index, live), [index, live]);
  const summary = useMemo(() => connectivitySummary(index, check.link), [index, check.link]);
  const selected = draft.find((c) => c.id === selectedId) ?? null;
  const savedIds = useMemo(() => new Set(base.map((c) => c.id)), [base]);

  // "Try a route" uses its own router holding the draft (built once).
  const draftRouter = useMemo(() => createRouter(geometry), [geometry]);
  const [draftVersion, setDraftVersion] = useState(0);
  const names = useMemo(
    () => Object.fromEntries(assignments.filter((a) => a.name).map((a) => [a.roomId, a.name])),
    [assignments],
  );
  useEffect(() => {
    draftRouter.setConnectors(draft);
    draftRouter.setNames(names);
    setDraftVersion((v) => v + 1);
  }, [draftRouter, draft, names]);
  const destinations = useMemo(
    () => searchableDestinations(geometry, assignments),
    [geometry, assignments],
  );

  // Esc puts the Add tools away.
  useEffect(() => {
    if (tool === 'select') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTool('select');
        setPointer(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool]);

  // Unsaved changes: ask before leaving (in the app), warn on closing the tab.
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function place(point: Point) {
    if (tool === 'select') {
      setSelectedId(null);
      return;
    }
    const connector = newConnector(tool, floor, point, draft);
    setDraft([...draft, connector]);
    setSelectedId(connector.id);
    setJustAddedId(connector.id);
    setTool('select');
    setPointer(null);
  }

  function changeAvailable(connector: Connector, available: boolean) {
    if (!savedIds.has(connector.id)) {
      setDraft((list) => setAvailable(list, connector.id, available));
      return;
    }
    markAvailable.mutate(
      { kind: 'connector', id: connector.id, available },
      {
        onSuccess: () => {
          setDraft((list) => setAvailable(list, connector.id, available));
          setBase((list) => setAvailable(list, connector.id, available));
        },
      },
    );
  }

  const panel = selected && (
    <ConnectorPanel
      key={selected.id}
      connector={selected}
      geometry={geometry}
      floor={floor}
      saved={savedIds.has(selected.id)}
      focusName={justAddedId === selected.id}
      availableBusy={markAvailable.isPending}
      onRename={(name) => setDraft(renameConnector(draft, selected.id, name))}
      onFloors={(floors) => setDraft(setFloorsServed(draft, selected.id, floors, geometry))}
      onMove={(point) => setDraft(moveConnector(draft, selected.id, floor, point))}
      onAccessible={(value) => setDraft(setAccessible(draft, selected.id, value))}
      onAvailable={(value) => changeAvailable(selected, value)}
      onShowFloor={setFloor}
      onDelete={() => {
        setDraft(removeConnector(draft, selected.id));
        setSelectedId(null);
      }}
    />
  );

  return (
    <div className="stack">
      {savedElsewhere && (
        <Card tone="alert" className="stack-tight">
          <p>Someone else saved stairs and lifts while you were editing.</p>
          <div className="row-wrap">
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                setDraft(saved);
                setBase(saved);
                setSavedElsewhere(false);
              }}
            >
              Load the saved version
            </Button>
            <Button size="small" variant="quiet" onClick={() => setSavedElsewhere(false)}>
              Keep mine (Save will replace theirs)
            </Button>
          </div>
        </Card>
      )}

      <div className={styles.toolbar}>
        <SegmentedControl<Tool>
          label="Tool"
          value={tool}
          onChange={(next) => {
            setTool(next);
            setPointer(null);
          }}
          options={[
            { value: 'select', label: 'Select' },
            { value: 'stairs', label: 'Add stairs' },
            { value: 'lift', label: 'Add lift' },
          ]}
        />
        <SegmentedControl
          label="Floor"
          value={floor}
          onChange={setFloor}
          options={geometry.floors.map((f) => ({ value: f.id, label: floorLabel(f.id) }))}
        />
      </div>
      <p className="meta">{footnotes.mapRooms.tools}</p>

      <div ref={measure} className={`${styles.layout} ${wide ? styles.wide : ''}`}>
        <div className={styles.mapColumn}>
          <FloorPlanView
            geometry={geometry}
            floor={floor}
            label={`${floorLabel(floor)} plan with its stairs and lifts. ${
              tool === 'select' ? 'Select or drag a marker.' : 'Click where the new one goes.'
            }`}
            quiet
            crosshair={tool !== 'select'}
            onMapClick={place}
            onPointerMove={tool === 'select' ? undefined : setPointer}
          >
            <ConnectorMarkers
              index={index}
              floor={floor}
              connectors={draft}
              link={check.link}
              selectedId={selectedId}
              draggable={tool === 'select'}
              dragging={dragging}
              onSelect={(id) => {
                setSelectedId(id);
                setJustAddedId(null);
              }}
              onDrag={(id, point) => setDragging({ id, point })}
              onDrop={(id, point) => {
                setDraft(moveConnector(draft, id, floor, point));
                setDragging(null);
                setSelectedId(id);
              }}
              adding={tool === 'select' ? null : { type: tool, point: pointer }}
            />
          </FloorPlanView>
        </div>

        <div className={styles.side}>
          {wide && panel && <Card>{panel}</Card>}
          {wide && !panel && (
            <p className="meta">
              {draft.length === 0
                ? 'No stairs or lifts yet. Pick Add stairs or Add lift above.'
                : 'Select a marker to edit it.'}
            </p>
          )}
          <Card>
            <ValidationPanel
              summary={summary}
              problems={check.problems}
              onPick={(problem) => {
                if (problem.floor) setFloor(problem.floor);
                if (problem.connector) setSelectedId(problem.connector);
              }}
            />
          </Card>
          <Card>
            <TryRoute
              destinations={destinations}
              route={(from, to, mode) => draftRouter.route(from, to, { mode })}
              draftVersion={draftVersion}
              connectorNames={Object.fromEntries(draft.map((c) => [c.id, c.name]))}
            />
          </Card>
        </div>
      </div>

      {!wide && (
        <Sheet
          open={selected !== null}
          title={selected?.name || 'Stairs or lift'}
          onClose={() => setSelectedId(null)}
        >
          {panel}
        </Sheet>
      )}

      {(dirty || save.isError) && (
        <div className={styles.saveBar} role="region" aria-label="Unsaved changes">
          <div className="stack-tight">
            <strong>Unsaved changes</strong>
            <span className="meta">
              {save.isError
                ? errorMessage(save.error)
                : check.hasErrors
                  ? 'Fix the problems marked Fix before saving.'
                  : footnotes.mapRooms.save}
            </span>
          </div>
          <div className="row">
            <Button variant="quiet" onClick={() => setConfirmDiscard(true)}>
              Discard
            </Button>
            <Button
              disabled={check.hasErrors || !dirty}
              loading={save.isPending}
              onClick={() => save.mutate(draft, { onSuccess: () => setBase(draft) })}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your changes?"
        confirmLabel="Discard"
        onConfirm={() => {
          setDraft(base);
          setSelectedId(null);
          setConfirmDiscard(false);
        }}
        onClose={() => setConfirmDiscard(false)}
      >
        <p>The stairs and lifts go back to how they were last saved.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Leave without saving?"
        confirmLabel="Leave"
        onConfirm={() => blocker.proceed?.()}
        onClose={() => blocker.reset?.()}
      >
        <p>Your changes to the stairs and lifts haven’t been saved, and will be lost.</p>
      </ConfirmDialog>
    </div>
  );
}
