// Map and rooms > Classrooms: name each room for a term.
//
// Map and list show the same thing two ways. Picking a room on either one
// selects it in both and opens the editor: beside the list on a laptop, as
// a sheet on a phone. Everything edits the term chosen in the term bar.
//
// Why changes show up everywhere at once: each save refetches the map data
// (navKeys), other devices hear about it through Realtime, and the shared
// router gets the new names (NavRouterProvider), so search and route steps
// use them straight away.
import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError } from '@/components/Input';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Sheet } from '@/components/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { checkAssignmentsCsv, roomRows, type RoomRow } from '@/features/map/nav/assignments';
import { FloorPlanView } from '@/features/map/nav/components/FloorPlanView';
import {
  useAssignments,
  useCreatePreset,
  useImportAssignments,
  usePresets,
} from '@/features/map/nav/hooks';
import { useNavRouter } from '@/features/map/nav/routerContext';
import type { Geometry } from '@/features/map/nav/types';
import { errorMessage } from '@/lib/errors';
import { footnotes } from '../../strings';
import { AssignmentCsv } from './AssignmentCsv';
import { floorLabel } from './labels';
import styles from './MapRooms.module.css';
import { RoomEditor } from './RoomEditor';
import { RoomTable } from './RoomTable';
import { TermBar } from './TermBar';
import { useSideBySide } from './useSideBySide';

export function ClassroomsTab() {
  const { geometry, activePresetId, error } = useNavRouter();
  const presets = usePresets();
  const [chosenId, setChosenId] = useState<string | null>(null);

  if (error) return <ErrorState error={error} />;
  if (presets.isError)
    return <ErrorState error={presets.error} onRetry={() => presets.refetch()} />;
  if (presets.isPending || !geometry) return <LoadingState label="Loading the map…" />;
  if (presets.data.length === 0) {
    return <FirstRun geometry={geometry} onCreated={setChosenId} />;
  }

  // The term being edited: the one picked, else the active one, else the first.
  const presetId =
    (chosenId && presets.data.some((preset) => preset.id === chosenId) && chosenId) ||
    (activePresetId &&
      presets.data.some((preset) => preset.id === activePresetId) &&
      activePresetId) ||
    presets.data[0].id;

  return (
    <div className="stack">
      <TermBar
        presets={presets.data}
        activeId={activePresetId}
        selectedId={presetId}
        onSelect={setChosenId}
      />
      <TermEditor
        key={presetId}
        geometry={geometry}
        presetId={presetId}
        presetName={presets.data.find((preset) => preset.id === presetId)?.name ?? ''}
      />
    </div>
  );
}

function TermEditor({
  geometry,
  presetId,
  presetName,
}: {
  geometry: Geometry;
  presetId: string;
  presetName: string;
}) {
  const assignments = useAssignments(presetId);
  const [measure, wide] = useSideBySide(780);
  const [floor, setFloor] = useState(geometry.floors[0]?.id ?? 'G');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // `seq` counters: a new pick moves the map or the list, re-renders don't.
  const [focus, setFocus] = useState<{ id: string; seq: number } | null>(null);
  const [scrollTo, setScrollTo] = useState<{ id: string; seq: number } | null>(null);

  const list = useMemo(() => assignments.data ?? [], [assignments.data]);
  const rows = useMemo(() => roomRows(geometry, list), [geometry, list]);
  const named = useMemo(() => new Set(rows.filter((r) => r.name).map((r) => r.id)), [rows]);
  const names = useMemo(
    () => Object.fromEntries(rows.filter((r) => r.name).map((r) => [r.id, r.name])),
    [rows],
  );

  if (assignments.isError) {
    return <ErrorState error={assignments.error} onRetry={() => assignments.refetch()} />;
  }
  if (assignments.isPending) return <LoadingState label="Loading room names…" />;

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  function pickFromList(row: RoomRow) {
    setSelectedId(row.id);
    setFloor(row.floor);
    setFocus((now) => ({ id: row.id, seq: (now?.seq ?? 0) + 1 }));
  }

  function pickFromMap(id: string) {
    setSelectedId(id);
    setScrollTo((now) => ({ id, seq: (now?.seq ?? 0) + 1 }));
  }

  const editor = selected && (
    <RoomEditor
      key={`${selected.id}:${presetId}`}
      row={selected}
      presetId={presetId}
      assignments={list}
      onDone={() => setSelectedId(null)}
    />
  );

  return (
    <>
      <AssignmentCsv
        geometry={geometry}
        presetId={presetId}
        presetName={presetName}
        assignments={list}
      />
      <div ref={measure} className={`${styles.layout} ${wide ? styles.wide : ''}`}>
        <div className={styles.mapColumn}>
          <SegmentedControl
            label="Floor"
            value={floor}
            onChange={setFloor}
            options={geometry.floors.map((f) => ({ value: f.id, label: floorLabel(f.id) }))}
          />
          <FloorPlanView
            geometry={geometry}
            floor={floor}
            label={`${floorLabel(floor)} plan. Click a room to edit it, or use the list.`}
            named={named}
            names={names}
            selectedId={selectedId}
            onSelect={pickFromMap}
            focus={focus}
          />
        </div>
        <div className={styles.side}>
          {wide && editor && <Card>{editor}</Card>}
          <RoomTable
            rows={rows}
            floors={geometry.floors.map((f) => f.id)}
            selectedId={selectedId}
            onPick={pickFromList}
            scrollTo={scrollTo}
          />
        </div>
      </div>
      {!wide && (
        <Sheet
          open={selected !== null}
          title={selected?.name || selected?.id || 'Room'}
          onClose={() => setSelectedId(null)}
        >
          {editor}
        </Sheet>
      )}
    </>
  );
}

/** No terms yet: start Term 1 from the names printed on the floor plan (or import a file later). */
function FirstRun({
  geometry,
  onCreated,
}: {
  geometry: Geometry;
  onCreated: (id: string) => void;
}) {
  const create = useCreatePreset();
  const importNames = useImportAssignments();
  const [problem, setProblem] = useState<string | null>(null);
  const busy = create.isPending || importNames.isPending;

  async function start() {
    setProblem(null);
    try {
      const text = (await import('@/features/map/nav/data/assignments.csv?raw')).default;
      const check = checkAssignmentsCsv(text, geometry);
      if (check.errors.length > 0) {
        setProblem(check.errors.join('\n'));
        return;
      }
      const id = await create.mutateAsync({ name: 'Term 1' });
      await importNames.mutateAsync({
        presetId: id,
        assignments: check.assignments,
        rows: check.lines,
      });
      onCreated(id);
    } catch (error) {
      setProblem(errorMessage(error));
    }
  }

  return (
    <EmptyState
      icon="map"
      title="No terms yet"
      action={
        <Button loading={busy} onClick={() => void start()}>
          Start Term 1 from the floor plan’s names
        </Button>
      }
    >
      <p>{footnotes.mapRooms.firstRun}</p>
      <FormError message={problem} />
    </EmptyState>
  );
}
