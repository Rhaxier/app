// Campus map (reference screen 2; design PDF page 6, "Find where"). The plan
// fills the screen, drawn like a real floor plan, with the controls floating
// over it in glass: room search and the floor switch, then chips for each
// layer. Tap a pin and its details rise in a sheet above the tab bar.
// Layers: rooms, rooms in use now (from approved bookings, live), and open
// fix-it reports (one count pin per room).
//
// The address remembers what's open (?room=G.14, ?report=<id> or ?floor=1),
// so links from other screens can open the map on the right thing.
// ?here=G.14 shows a "You are here" pin, e.g. from a QR code on a door.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterChip } from '@/components/Chip';
import { PageChrome } from '@/components/PageChrome';
import { PageHeader } from '@/components/PageHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { OPEN_STATUSES } from '@/features/fixit/api';
import { ReportCard } from '@/features/fixit/components/ReportCard';
import { useLiveReports, useReports } from '@/features/fixit/hooks';
import { reportTitle } from '@/features/fixit/logic';
import { useBookingsNow, useLiveBookings, useVenues } from '@/features/venues/hooks';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { MapView } from '../components/MapView';
import { BusyPin, HerePin, ReportPin, RoomPin } from '../components/Pins';
import { RoomCard } from '../components/RoomCard';
import { RoomSearch } from '../components/RoomSearch';
import { useLegacyFloors, useLegacyRooms } from '../hooks';
import { reportSpots, roomsInUse } from '../logic';
import styles from './MapPage.module.css';

type Layer = 'rooms' | 'inUse' | 'reports';

// Where the plan fits on screen, clear of the floating controls (px): below
// the search bar and chips, above the hint and the tab bar.
const PLAN_MARGINS = { top: 132, bottom: 150 };

export function MapPage() {
  useDocumentTitle('Campus map');
  // The old map always shows the old floors and rooms (the switch to the
  // indoor map replaces this whole screen: MapSwitchPage).
  const floors = useLegacyFloors();
  const rooms = useLegacyRooms();
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

  if (floors.isPending || rooms.isPending) return <LoadingState shape="block" />;
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

  const openReports = (reports.data ?? []).filter((report) =>
    OPEN_STATUSES.includes(report.status),
  );
  const selectedReport = openReports.find((report) => report.id === searchParams.get('report'));
  const selectedRoom = rooms.data.find((room) => room.code === searchParams.get('room'));
  const hereRoom = rooms.data.find((room) => room.code === searchParams.get('here'));
  const floor =
    floors.data.find((f) => f.id === (selectedReport?.floor_id ?? selectedRoom?.floor_id)) ??
    floors.data.find((f) => f.name === searchParams.get('floor')) ??
    floors.data.find((f) => f.id === hereRoom?.floor_id) ??
    floors.data[0];
  const floorRooms = rooms.data.filter((room) => room.floor_id === floor.id);
  const floorReports = openReports.filter(
    (report) => report.floor_id === floor.id && report.x !== null && report.y !== null,
  );
  const spots = reportSpots(floorReports.map((r) => ({ ...r, x: r.x!, y: r.y! })));
  const selectedSpot = spots.find((spot) => spot.reports.some((r) => r.id === selectedReport?.id));
  const busy = roomsInUse(bookingsNow.data ?? [], venues.data ?? []);

  // Changing what's selected keeps the "You are here" pin, if there is one.
  function show(params: Record<string, string>) {
    const here = searchParams.get('here');
    setSearchParams(here ? { ...params, here } : params, { replace: true });
  }

  function toggle(layer: Layer) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  const sheetOpen = Boolean(selectedReport || selectedRoom);

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">Campus map</h1>

      {/* The map and its controls are fixed to the screen: PageChrome keeps
          them in place (and fades them) while screens slide. */}
      <PageChrome attributes={{ 'data-sheet': sheetOpen || undefined }}>
        <MapView floor={floor} label={`Floor ${floor.name} plan`} immersive={PLAN_MARGINS}>
          {floorRooms.map((room) => {
            const inUse = busy.get(room.id);
            const selected = room.id === selectedRoom?.id;
            if (inUse && layers.inUse) {
              return (
                <BusyPin
                  key={room.id}
                  floor={floor}
                  x={room.x}
                  y={room.y}
                  code={room.code}
                  title={`${room.code} ${room.name}: in use, ${inUse.title}`}
                  selected={selected}
                  onSelect={() => show({ room: room.code })}
                />
              );
            }
            if (!layers.rooms && !selected) return null;
            return (
              <RoomPin
                key={room.id}
                floor={floor}
                x={room.x}
                y={room.y}
                code={room.code}
                title={`${room.code} ${room.name}`}
                selected={selected}
                onSelect={() => show({ room: room.code })}
              />
            );
          })}
          {layers.reports &&
            spots.map((spot) => {
              const first = spot.reports[0];
              const where = first.room_code ? ` in ${first.room_code}` : '';
              return (
                <ReportPin
                  key={spot.key}
                  floor={floor}
                  x={spot.x}
                  y={spot.y}
                  count={spot.reports.length}
                  title={
                    spot.reports.length === 1
                      ? `Fix-it report${where}: ${reportTitle(first.description)}`
                      : `${spot.reports.length} fix-it reports${where}`
                  }
                  selected={spot === selectedSpot}
                  onSelect={() => show({ report: first.id })}
                />
              );
            })}
          {hereRoom?.floor_id === floor.id && (
            <HerePin floor={floor} x={hereRoom.x} y={hereRoom.y} />
          )}
        </MapView>

        {/* Floating controls over the top of the plan. */}
        <div className={styles.top}>
          <div className={styles.topRow}>
            <RoomSearch
              rooms={rooms.data}
              floorName={(id) => floors.data.find((f) => f.id === id)?.name ?? ''}
              onPick={(room) => show({ room: room.code })}
            />
            <SegmentedControl
              label="Floor"
              compact
              floating
              value={floor.name}
              onChange={(name) => show({ floor: name })}
              options={floors.data.map((f) => ({ value: f.name, label: f.name }))}
            />
          </div>
          <div className={`scroll-row ${styles.chips}`} role="group" aria-label="Show on the map">
            <FilterChip
              glass
              marker="report"
              selected={layers.reports}
              onClick={() => toggle('reports')}
            >
              {floorReports.length > 0
                ? `${floorReports.length} open fix-it ${floorReports.length === 1 ? 'report' : 'reports'}`
                : 'Fix-it reports'}
            </FilterChip>
            <FilterChip glass marker="room" selected={layers.rooms} onClick={() => toggle('rooms')}>
              Rooms
            </FilterChip>
            <FilterChip glass marker="busy" selected={layers.inUse} onClick={() => toggle('inUse')}>
              In use now
            </FilterChip>
          </div>
        </div>

        {/* The details sheet, or a hint, just above the tab bar. */}
        <div className={styles.bottom}>
          {selectedReport && (
            <ReportCard
              report={selectedReport}
              others={selectedSpot?.reports ?? [selectedReport]}
              onPick={(id) => show({ report: id })}
            />
          )}
          {selectedRoom && !selectedReport && (
            <RoomCard
              room={selectedRoom}
              inUse={busy.get(selectedRoom.id)}
              venue={venues.data?.find((venue) => venue.room_id === selectedRoom.id)}
              openReports={
                openReports.filter((report) => report.room_id === selectedRoom.id).length
              }
            />
          )}
          {!sheetOpen && (
            <p className={`glass thin ${styles.hint}`}>Tap a pin, or search, to see a room.</p>
          )}
        </div>
      </PageChrome>
    </div>
  );
}
