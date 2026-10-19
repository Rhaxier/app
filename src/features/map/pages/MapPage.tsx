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
import { OPEN_STATUSES } from '@/features/fixit/api';
import { ReportCard } from '@/features/fixit/components/ReportCard';
import { useLiveReports, useReports } from '@/features/fixit/hooks';
import { reportTitle } from '@/features/fixit/logic';
import { useBookingsNow, useLiveBookings, useVenues } from '@/features/venues/hooks';
import { MapView } from '../components/MapView';
import { BusyPin, ReportPin, RoomPin } from '../components/Pins';
import { RoomCard } from '../components/RoomCard';
import { RoomSearch } from '../components/RoomSearch';
import { useFloors, useRooms } from '../hooks';
import { reportPinPosition, roomsInUse } from '../logic';

type Layer = 'rooms' | 'inUse' | 'reports';

export function MapPage() {
  const floors = useFloors();
  const rooms = useRooms();
  const venues = useVenues();
  const bookingsNow = useBookingsNow();
  const reports = useReports();
  useLiveBookings();
  useLiveReports();
  const [searchParams, setSearchParams] = useSearchParams();
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    rooms: true,
    inUse: true,
    reports: true,
  });

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

  // The address remembers what's open (?room=G.14, ?report=<id> or ?floor=1),
  // so links from other screens can open the map on the right thing.
  const openReports = (reports.data ?? []).filter((report) =>
    OPEN_STATUSES.includes(report.status),
  );
  const selectedReport = openReports.find((report) => report.id === searchParams.get('report'));
  const selectedRoom = rooms.data.find((room) => room.code === searchParams.get('room'));
  const floor =
    floors.data.find((f) => f.id === (selectedReport?.floor_id ?? selectedRoom?.floor_id)) ??
    floors.data.find((f) => f.name === searchParams.get('floor')) ??
    floors.data[0];
  const floorRooms = rooms.data.filter((room) => room.floor_id === floor.id);
  const floorReports = openReports.filter(
    (report) => report.floor_id === floor.id && report.x !== null,
  );
  const busy = roomsInUse(bookingsNow.data ?? [], venues.data ?? []);

  function selectRoom(code: string) {
    setSearchParams({ room: code }, { replace: true });
  }

  function selectReport(id: string) {
    setSearchParams({ report: id }, { replace: true });
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
        <FilterChip marker="report" selected={layers.reports} onClick={() => toggle('reports')}>
          Fix-it reports
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
        {layers.reports &&
          floorReports.map((report) => {
            const sameRoom = floorReports.filter((r) => r.room_id === report.room_id);
            const position = reportPinPosition(report.x!, report.y!, sameRoom.indexOf(report));
            return (
              <ReportPin
                key={report.id}
                floor={floor}
                x={position.x}
                y={position.y}
                title={`Fix-it report${report.room_code ? ` in ${report.room_code}` : ''}: ${reportTitle(report.description)}`}
                selected={report.id === selectedReport?.id}
                onSelect={() => selectReport(report.id)}
              />
            );
          })}
      </MapView>

      {selectedReport && <ReportCard report={selectedReport} />}
      {selectedRoom && !selectedReport && (
        <RoomCard
          room={selectedRoom}
          inUse={busy.get(selectedRoom.id)}
          venue={venues.data?.find((venue) => venue.room_id === selectedRoom.id)}
          openReports={openReports.filter((report) => report.room_id === selectedRoom.id).length}
        />
      )}
      {!selectedRoom && !selectedReport && (
        <p className="meta">Tap a pin, or search, to see a room.</p>
      )}
    </div>
  );
}
