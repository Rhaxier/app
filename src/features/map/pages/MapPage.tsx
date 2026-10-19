// Campus map (reference screen 2): floor switcher, room search, layer chips,
// the floor plan with pins, and a details card for whatever is selected.
// Layers: rooms, rooms in use now (from approved bookings, live), and open
// fix-it reports.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterChip } from '@/components/Chip';
import { PageHeader } from '@/components/PageHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useBookingsNow, useLiveBookings, useVenues } from '@/features/venues/hooks';
import { MapView } from '../components/MapView';
import { BusyPin, RoomPin } from '../components/Pins';
import { RoomCard } from '../components/RoomCard';
import { RoomSearch } from '../components/RoomSearch';
import { useFloors, useRooms } from '../hooks';
import { roomsInUse } from '../logic';

type Layer = 'rooms' | 'inUse';

export function MapPage() {
  const floors = useFloors();
  const rooms = useRooms();
  const venues = useVenues();
  const bookingsNow = useBookingsNow();
  useLiveBookings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ rooms: true, inUse: true });

  if (floors.isPending || rooms.isPending) return <LoadingState />;
  if (floors.isError) return <ErrorState error={floors.error} onRetry={() => floors.refetch()} />;
  if (rooms.isError) return <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />;
  if (floors.data.length === 0) {
    return (
      <div className="stack">
        <PageHeader title="Campus map" />
        <EmptyState icon="map" title="No floor plans yet">
          An admin adds floors and rooms on the Admin screen.
        </EmptyState>
      </div>
    );
  }

  // The address remembers what's open (?room=G.14 or ?floor=1), so links from
  // other screens (an event's "Where") can open the map on the right room.
  const selectedRoom = rooms.data.find((room) => room.code === searchParams.get('room'));
  const floor =
    floors.data.find((f) => f.id === selectedRoom?.floor_id) ??
    floors.data.find((f) => f.name === searchParams.get('floor')) ??
    floors.data[0];
  const floorRooms = rooms.data.filter((room) => room.floor_id === floor.id);
  const busy = roomsInUse(bookingsNow.data ?? [], venues.data ?? []);

  function selectRoom(code: string | null) {
    setSearchParams(code ? { room: code } : { floor: floor.name }, { replace: true });
  }

  function toggle(layer: Layer) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  return (
    <div className="stack">
      <PageHeader
        title="Campus map"
        action={
          <SegmentedControl
            label="Floor"
            compact
            value={floor.name}
            onChange={(name) => setSearchParams({ floor: name }, { replace: true })}
            options={floors.data.map((f) => ({ value: f.name, label: f.name }))}
          />
        }
      />

      <RoomSearch
        rooms={rooms.data}
        floorName={(id) => floors.data.find((f) => f.id === id)?.name ?? ''}
        onPick={(room) => selectRoom(room.code)}
      />

      <div className="row-wrap" role="group" aria-label="Show on the map">
        <FilterChip marker="room" selected={layers.rooms} onClick={() => toggle('rooms')}>
          Rooms
        </FilterChip>
        <FilterChip marker="busy" selected={layers.inUse} onClick={() => toggle('inUse')}>
          In use now
        </FilterChip>
      </div>

      <MapView floor={floor} label={`Floor ${floor.name} plan`}>
        {floorRooms.map((room) => {
          const inUse = busy.get(room.id);
          if (inUse && layers.inUse) {
            return (
              <BusyPin
                key={room.id}
                floor={floor}
                x={room.x}
                y={room.y}
                title={`${room.code} ${room.name}: in use, ${inUse.title}`}
                selected={room.id === selectedRoom?.id}
                onSelect={() => selectRoom(room.code)}
              />
            );
          }
          if (!layers.rooms) return null;
          return (
            <RoomPin
              key={room.id}
              floor={floor}
              x={room.x}
              y={room.y}
              title={`${room.code} ${room.name}`}
              selected={room.id === selectedRoom?.id}
              onSelect={() => selectRoom(room.code)}
            />
          );
        })}
      </MapView>

      {selectedRoom ? (
        <RoomCard
          room={selectedRoom}
          inUse={busy.get(selectedRoom.id)}
          venue={venues.data?.find((venue) => venue.room_id === selectedRoom.id)}
          openReports={0}
        />
      ) : (
        <p className="meta">Tap a pin, or search, to see a room.</p>
      )}
    </div>
  );
}
