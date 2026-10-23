// Admin > Map (Q6). Choose a room, then click the plan to move its pin.
// Also: edit or add rooms, and point a floor at a new plan image.
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError, SelectField, TextField } from '@/components/Input';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ErrorState, LoadingState } from '@/components/States';
import type { Floor, Room } from '@/features/map/api';
import { MapView } from '@/features/map/components/MapView';
import { RoomPin } from '@/features/map/components/Pins';
import {
  useCreateRoom,
  useDeleteRoom,
  useFloors,
  useRooms,
  useUpdateFloor,
  useUpdateRoom,
} from '@/features/map/hooks';
import { errorMessage } from '@/lib/errors';
import { roomKindLabel } from '@/lib/status';
import { Constants, type Enums } from '@/types/database';
import { validateRoom } from '../logic';
import styles from './MapAdminPage.module.css';
import { AdminPage } from '../components/AdminPage';

type RoomKind = Enums<'room_kind'>;
const roomKinds = Constants.public.Enums.room_kind as readonly RoomKind[];

export function MapAdminPage() {
  const floors = useFloors();
  const rooms = useRooms();
  const updateRoom = useUpdateRoom();
  const [floorId, setFloorId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (floors.isPending || rooms.isPending) return <LoadingState />;
  if (floors.isError) return <ErrorState error={floors.error} onRetry={() => floors.refetch()} />;
  if (rooms.isError) return <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />;

  const floor = floors.data.find((f) => f.id === floorId) ?? floors.data[0];
  const floorRooms = rooms.data.filter((room) => room.floor_id === floor?.id);
  const selected = floorRooms.find((room) => room.id === selectedId) ?? null;

  return (
    <AdminPage title="Map">
      {!floor ? (
        <p className="meta">No floors yet.</p>
      ) : (
        <>
          <SegmentedControl
            label="Floor"
            value={floor.id}
            onChange={(id) => {
              setFloorId(id);
              setSelectedId(null);
            }}
            options={floors.data.map((f) => ({ value: f.id, label: `Floor ${f.name}` }))}
          />
          <p className={styles.hint} aria-live="polite">
            {selected
              ? `Click the plan to move ${selected.code}.`
              : 'Choose a room below, then click the plan to place it.'}
          </p>
          <MapView
            floor={floor}
            label={`Floor ${floor.name} plan editor`}
            onMapClick={(point) =>
              selected && updateRoom.mutate({ id: selected.id, changes: point })
            }
          >
            {floorRooms.map((room) => (
              <RoomPin
                key={room.id}
                floor={floor}
                x={room.x}
                y={room.y}
                title={`${room.code} ${room.name}`}
                selected={room.id === selected?.id}
                onSelect={() => setSelectedId(room.id)}
              />
            ))}
          </MapView>
          <FormError message={updateRoom.isError ? errorMessage(updateRoom.error) : null} />

          <div className="row-wrap" role="group" aria-label="Rooms on this floor">
            {floorRooms.map((room) => (
              <Button
                key={room.id}
                size="small"
                variant={room.id === selected?.id ? 'primary' : 'secondary'}
                aria-pressed={room.id === selected?.id}
                onClick={() => setSelectedId(room.id)}
              >
                {room.code}
              </Button>
            ))}
          </div>

          {selected && (
            <RoomEditor
              key={selected.id}
              room={selected}
              otherCodes={rooms.data.filter((r) => r.id !== selected.id).map((r) => r.code)}
              onDeleted={() => setSelectedId(null)}
            />
          )}
          <NewRoom
            floor={floor}
            existingCodes={rooms.data.map((r) => r.code)}
            onCreated={setSelectedId}
          />
          <FloorEditor key={floor.id} floor={floor} />
        </>
      )}
    </AdminPage>
  );
}

function RoomEditor({
  room,
  otherCodes,
  onDeleted,
}: {
  room: Room;
  otherCodes: string[];
  onDeleted: () => void;
}) {
  const update = useUpdateRoom();
  const remove = useDeleteRoom();
  const [code, setCode] = useState(room.code);
  const [name, setName] = useState(room.name);
  const [kind, setKind] = useState<RoomKind>(room.kind);
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateRoom({ code, name }, otherCodes);
    setErrors(found);
    if (Object.keys(found).length === 0)
      update.mutate({ id: room.id, changes: { code: code.trim(), name: name.trim(), kind } });
  }

  return (
    <Card as="section" className="stack-tight" aria-label={`Edit ${room.code}`}>
      <h2 className={styles.heading}>Room {room.code}</h2>
      <p className="meta">
        Pin at x {Math.round(room.x)}, y {Math.round(room.y)}
      </p>
      <form className="stack-tight" onSubmit={handleSubmit} noValidate>
        <div className={styles.twoColumns}>
          <TextField
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={errors.code}
          />
          <SelectField
            label="Kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as RoomKind)}
          >
            {roomKinds.map((k) => (
              <option key={k} value={k}>
                {roomKindLabel[k]}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <FormError
          message={
            update.error
              ? errorMessage(update.error)
              : remove.error
                ? errorMessage(remove.error)
                : null
          }
        />
        <div className={styles.twoColumns}>
          <Button
            variant="quiet"
            icon="trash"
            loading={remove.isPending}
            onClick={() => remove.mutate(room.id, { onSuccess: onDeleted })}
          >
            Delete
          </Button>
          <Button type="submit" loading={update.isPending}>
            Save room
          </Button>
        </div>
      </form>
    </Card>
  );
}

function NewRoom({
  floor,
  existingCodes,
  onCreated,
}: {
  floor: Floor;
  existingCodes: string[];
  onCreated: (id: string) => void;
}) {
  const create = useCreateRoom();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateRoom({ code, name }, existingCodes);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    // New rooms start in the middle of the plan; click to move them.
    const id = crypto.randomUUID();
    create.mutate(
      {
        id,
        floor_id: floor.id,
        code: code.trim(),
        name: name.trim(),
        x: floor.width / 2,
        y: floor.height / 2,
      },
      {
        onSuccess: () => {
          setCode('');
          setName('');
          onCreated(id);
        },
      },
    );
  }

  return (
    <Card as="section" className="stack-tight" aria-label="Add a room">
      <h2 className={styles.heading}>Add a room to floor {floor.name}</h2>
      <form className="stack-tight" onSubmit={handleSubmit} noValidate>
        <div className={styles.twoColumns}>
          <TextField
            label="Code"
            placeholder="G.14"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={errors.code}
          />
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
        </div>
        <FormError message={create.isError ? errorMessage(create.error) : null} />
        <Button type="submit" variant="secondary" icon="plus" loading={create.isPending}>
          Add room
        </Button>
      </form>
    </Card>
  );
}

function FloorEditor({ floor }: { floor: Floor }) {
  const update = useUpdateFloor();
  const [imagePath, setImagePath] = useState(floor.image_path);
  const [width, setWidth] = useState(String(floor.width));
  const [height, setHeight] = useState(String(floor.height));
  const valid = imagePath.trim() && Number(width) > 0 && Number(height) > 0;

  return (
    <Card as="section" className="stack-tight" aria-label={`Floor ${floor.name} image`}>
      <h2 className={styles.heading}>Floor {floor.name} plan image</h2>
      <p className="meta">
        Put the file in public/floorplans/, then enter its path and pixel size.
      </p>
      <TextField
        label="Image path"
        value={imagePath}
        onChange={(e) => setImagePath(e.target.value)}
      />
      <div className={styles.twoColumns}>
        <TextField
          label="Width (px)"
          type="number"
          value={width}
          onChange={(e) => setWidth(e.target.value)}
        />
        <TextField
          label="Height (px)"
          type="number"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
        />
      </div>
      <FormError message={update.isError ? errorMessage(update.error) : null} />
      <Button
        variant="secondary"
        disabled={!valid}
        loading={update.isPending}
        onClick={() =>
          update.mutate({
            id: floor.id,
            changes: { image_path: imagePath.trim(), width: Number(width), height: Number(height) },
          })
        }
      >
        Save floor
      </Button>
    </Card>
  );
}
