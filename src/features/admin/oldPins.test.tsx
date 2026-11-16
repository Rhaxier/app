// Admin > Map (old pins) after the release: the placeholder rooms are
// retired and the floors have no images, so the page points to Map and rooms
// instead of the old editor.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const pending = { isPending: true, isError: false, data: undefined };
vi.mock('@/features/map/hooks', () => ({
  useIndoorMapLive: () => ({ live: true, ready: true }),
  useLegacyFloors: () => pending,
  useLegacyRooms: () => pending,
  useUpdateRoom: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateRoom: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteRoom: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateFloor: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadFloorPlan: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { MapAdminPage } from './pages/MapAdminPage';

describe('Map (old pins) once the indoor map is live', () => {
  it('says the old pins are retired and links to Map and rooms', () => {
    render(
      <MemoryRouter>
        <MapAdminPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/these old pins are retired/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Map and rooms' })).toHaveAttribute(
      'href',
      '/admin/map-rooms',
    );
  });
});
