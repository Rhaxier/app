// The switch to the indoor map (rooms migration B turns on
// app_settings.map_indoor_live): /map, the room lists and the old pins page
// follow it. Supabase is replaced by fakes; the migration itself is tested in
// supabase/tests/22_rooms_migration_b_test.sql.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  live: false,
  fetchIndoorMapLive: vi.fn(),
  fetchRooms: vi.fn(),
  fetchIndoorRooms: vi.fn(),
  fetchFloors: vi.fn(),
  fetchAllFloors: vi.fn(),
}));
vi.mock('./api', () => ({
  fetchIndoorMapLive: api.fetchIndoorMapLive,
  fetchRooms: api.fetchRooms,
  fetchIndoorRooms: api.fetchIndoorRooms,
  fetchFloors: api.fetchFloors,
  fetchAllFloors: api.fetchAllFloors,
  createRoom: vi.fn(),
  deleteRoom: vi.fn(),
  updateFloor: vi.fn(),
  updateRoom: vi.fn(),
  uploadFloorPlan: vi.fn(),
}));
vi.mock('./pages/IndoorMapPage', () => ({ IndoorMapPage: () => <p>Indoor map</p> }));
vi.mock('./pages/MapPage', () => ({ MapPage: () => <p>Old map</p> }));

import { useRooms } from './hooks';
import { roomLabel } from './logic';
import { MapSwitchPage } from './pages/MapSwitchPage';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchIndoorMapLive.mockImplementation(async () => api.live);
  api.fetchRooms.mockResolvedValue([{ id: 'old', code: 'G.04', name: 'Classroom G.04' }]);
  api.fetchIndoorRooms.mockResolvedValue([{ id: 'new', code: 'G-R030', name: 'PYP3 B' }]);
});

describe('the switch to the indoor map', () => {
  it('before the release: /map is the old map and room lists are the placeholders', async () => {
    api.live = false;
    render(<MapSwitchPage />, { wrapper });
    expect(await screen.findByText('Old map')).toBeInTheDocument();
    const rooms = renderHook(() => useRooms(), { wrapper });
    await waitFor(() => expect(rooms.result.current.data?.[0].id).toBe('old'));
    expect(api.fetchIndoorRooms).not.toHaveBeenCalled();
  });

  it('after the release: /map is the indoor map and room lists are the traced rooms', async () => {
    api.live = true;
    render(<MapSwitchPage />, { wrapper });
    expect(await screen.findByText('Indoor map')).toBeInTheDocument();
    const rooms = renderHook(() => useRooms(), { wrapper });
    await waitFor(() => expect(rooms.result.current.data?.[0].id).toBe('new'));
    expect(api.fetchRooms).not.toHaveBeenCalled();
  });
});

describe('roomLabel', () => {
  it('names traced rooms by name and floor, placeholders by code and name', () => {
    expect(roomLabel({ code: 'G-R030', name: 'PYP3 B' })).toBe('PYP3 B (Ground floor)');
    expect(roomLabel({ code: '2-P01', name: 'Staff Room' })).toBe('Staff Room (Floor 2)');
    expect(roomLabel({ code: 'G.04', name: 'Classroom G.04' })).toBe('G.04 · Classroom G.04');
  });
});
