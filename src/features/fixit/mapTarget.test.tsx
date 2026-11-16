// Fix-it reports about a lift, staircase or door: the choices on the form,
// what the form sends, and who gets "Mark out of order" (on a report's staff
// panel and on the map's lift/stairs card). The map hooks are fakes; the
// database rules are tested in supabase/tests/21_report_map_target_test.sql.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connector } from '@/features/map/nav/types';
import type { Report } from './api';
import { parseMapTarget, toReportInput } from './logic';
import { mapTargetOptions } from './mapTargets';

const nav = vi.hoisted(() => ({
  canMark: false,
  connectors: [] as Connector[],
  mutate: vi.fn(),
}));
vi.mock('@/features/map/nav/hooks', () => ({
  useCanMarkOutOfOrder: () => ({ data: nav.canMark }),
  useConnectors: () => ({ data: nav.connectors }),
  useOverrides: () => ({ data: { doorAvailable: { 'G-D089': false }, edgeTags: {} } }),
  useSetAvailable: () => ({
    mutate: nav.mutate,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

import { ConnectorCard } from '@/features/map/components/ConnectorCard';
import { MapTargetControls } from './components/MapTargetControls';

const lift: Connector = {
  id: 'lift-1',
  type: 'lift',
  name: 'East lift',
  floors: ['G', '1'],
  positions: { G: { x: 1, y: 1 }, 1: { x: 1, y: 1 } },
  accessible: true,
  available: true,
};
const stairs: Connector = {
  ...lift,
  id: 'stairs-3',
  type: 'stairs',
  name: 'Top stairs',
  floors: ['2', '3'],
  accessible: false,
};

function report(change: Partial<Report> = {}): Report {
  return {
    id: 'r1',
    reporter_id: null,
    reporter_name: null,
    reported_by_me: false,
    room_id: null,
    room_code: null,
    room_name: null,
    floor_id: null,
    x: null,
    y: null,
    category: 'other',
    category_name: 'Other',
    routed_to: 'facilities',
    description: 'Lift doors stuck',
    photo_path: null,
    status: 'open',
    status_note: null,
    assigned_to: null,
    assigned_to_name: null,
    urgent: false,
    duplicate_of: null,
    resolved_at: null,
    created_at: '',
    vote_count: 0,
    voted_by_me: false,
    map_target_kind: 'connector',
    map_target_id: 'lift-1',
    map_target_name: 'East lift',
    ...change,
  };
}

beforeEach(() => {
  nav.canMark = false;
  nav.connectors = [lift, stairs];
  nav.mutate.mockReset();
  nav.mutate.mockImplementation((_input: unknown, options?: { onSuccess?: () => void }) =>
    options?.onSuccess?.(),
  );
});

describe('the report form', () => {
  it('offers the lifts and stairs on the room’s floor, then the room’s doors', () => {
    const options = mapTargetOptions(
      [lift, { ...stairs, available: false }],
      'G',
      [{ id: 'G-D089', b: 'G-R074' }],
      '',
    );
    expect(options.map((o) => o.label)).toEqual(['East lift', 'Door 1 of this room (G-D089)']);
  });

  it('keeps a lift chosen on the map even when the floor isn’t known, and labels out-of-order ones', () => {
    const options = mapTargetOptions([{ ...stairs, available: false }], null, [], '');
    expect(options).toEqual([
      { value: 'connector:stairs-3', label: 'Top stairs (marked out of order)' },
    ]);
  });

  it('sends what the report is about, or nothing', () => {
    const values = {
      roomId: 'room',
      category: 'other' as const,
      description: ' x ',
      urgent: false,
      photo: null,
    };
    expect(toReportInput({ ...values, mapTarget: 'door:G-D089' })).toMatchObject({
      map_target_kind: 'door',
      map_target_id: 'G-D089',
    });
    expect(toReportInput({ ...values, mapTarget: '' })).toMatchObject({
      map_target_kind: null,
      map_target_id: null,
    });
    expect(parseMapTarget('connector:abc')).toEqual({ kind: 'connector', id: 'abc' });
    expect(parseMapTarget('bogus')).toBeNull();
  });
});

describe('the staff panel', () => {
  it('shows what the report is about, without the button for staff who can’t mark it', () => {
    render(<MapTargetControls report={report()} allReports={[]} resolvedSeq={0} />);
    expect(screen.getByText('East lift')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark out of order' })).not.toBeInTheDocument();
  });

  it('lets the right staff mark it out of order, after a confirm', async () => {
    nav.canMark = true;
    render(<MapTargetControls report={report()} allReports={[]} resolvedSeq={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mark out of order' }));
    expect(nav.mutate).not.toHaveBeenCalled();
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark out of order' }),
    );
    expect(nav.mutate.mock.calls[0][0]).toEqual({
      kind: 'connector',
      id: 'lift-1',
      available: false,
    });
  });

  it('asks to put it back in service when the report is resolved, and counts other reports', () => {
    nav.canMark = true;
    nav.connectors = [{ ...lift, available: false }, stairs];
    const others = [report({ id: 'r2' }), report({ id: 'r3', status: 'resolved' })];
    const { rerender } = render(
      <MapTargetControls report={report()} allReports={others} resolvedSeq={0} />,
    );
    rerender(<MapTargetControls report={report()} allReports={others} resolvedSeq={1} />);
    const dialog = screen.getByRole('dialog', { name: 'Mark East lift as working again?' });
    expect(dialog).toHaveTextContent('1 other open report is also about it.');
  });

  it('handles a door: shows its state from the flags', () => {
    nav.canMark = true;
    render(
      <MapTargetControls
        report={report({ map_target_kind: 'door', map_target_id: 'G-D089', map_target_name: null })}
        allReports={[]}
        resolvedSeq={0}
      />,
    );
    expect(screen.getByText(/marked out of order/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back in service' })).toBeInTheDocument();
  });
});

describe('the lift card on the map', () => {
  const renderCard = () =>
    render(
      <MemoryRouter>
        <ConnectorCard connector={lift} floor="G" onClose={() => {}} />
      </MemoryRouter>,
    );

  it('lets anyone report a problem with it', () => {
    renderCard();
    expect(screen.getByRole('link', { name: 'Report a problem' })).toHaveAttribute(
      'href',
      '/map/report?target=connector%3Alift-1&floor=G',
    );
    expect(screen.queryByRole('button', { name: 'Mark out of order' })).not.toBeInTheDocument();
  });

  it('gives the right staff Mark out of order', async () => {
    nav.canMark = true;
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Mark out of order' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark out of order' }),
    );
    expect(nav.mutate.mock.calls[0][0]).toEqual({
      kind: 'connector',
      id: 'lift-1',
      available: false,
    });
  });
});
