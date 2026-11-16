// Admin > Map and rooms: the menu entries, the term bar's rules, and the
// import preview. The data hooks are replaced by fakes, so these tests check
// what the screen allows and what it sends, not the database (that is in
// supabase/tests/19_map_nav_test.sql).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
});
const hooks = vi.hoisted(() => ({
  useSetActivePreset: vi.fn(),
  useDeletePreset: vi.fn(),
  useCreatePreset: vi.fn(),
  useRenamePreset: vi.fn(),
  useSaveAssignments: vi.fn(),
}));
vi.mock('@/features/map/nav/hooks', () => hooks);

import { adminGroups } from './sections';
import { TermBar } from './components/map-rooms/TermBar';
import { ImportPreview } from './components/map-rooms/AssignmentCsv';
import { RoomEditor } from './components/map-rooms/RoomEditor';

const presets = [
  { id: 't1', name: 'Term 1', created_at: '' },
  { id: 't2', name: 'Term 2', created_at: '' },
];

beforeEach(() => {
  for (const hook of Object.values(hooks)) hook.mockReturnValue(mutation());
});

describe('admin menu', () => {
  const titles = adminGroups.flatMap((group) => group.sections.map((section) => section.title));

  it('adds "Map and rooms" and keeps the old page as "Map (old pins)"', () => {
    expect(titles).toContain('Map and rooms');
    expect(titles).toContain('Map (old pins)');
    expect(titles).not.toContain('Map');
  });
});

describe('TermBar', () => {
  it('says when the term being edited is not the one students see', () => {
    render(<TermBar presets={presets} activeId="t1" selectedId="t2" onSelect={() => {}} />);
    expect(screen.getByText('Editing a term that is not active')).toBeInTheDocument();
  });

  it('switches the active term only after the confirm, with one call', async () => {
    const activate = mutation();
    hooks.useSetActivePreset.mockReturnValue(activate);
    render(<TermBar presets={presets} activeId="t1" selectedId="t2" onSelect={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Make active' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Students will see Term 2 room names straight away.'),
    ).toBeInTheDocument();
    expect(activate.mutate).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Make active' }));
    expect(activate.mutate).toHaveBeenCalledTimes(1);
    expect(activate.mutate.mock.calls[0][0]).toBe('t2');
  });

  it('does not offer to delete or re-activate the active term', () => {
    render(<TermBar presets={presets} activeId="t1" selectedId="t1" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Make active' })).not.toBeInTheDocument();
    expect(screen.getByText('Active: students see these names')).toBeInTheDocument();
  });

  it('refuses a new term with a name already in use, before asking the database', async () => {
    const create = mutation();
    hooks.useCreatePreset.mockReturnValue(create);
    render(<TermBar presets={presets} activeId="t1" selectedId="t1" onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'New term' }));
    await userEvent.type(screen.getByLabelText('Name'), 'term 2');
    await userEvent.click(screen.getByRole('button', { name: 'Create term' }));
    expect(screen.getByText('There is already a term called “term 2”.')).toBeInTheDocument();
    expect(create.mutate).not.toHaveBeenCalled();
  });
});

describe('ImportPreview', () => {
  const current = [
    { roomId: 'A', name: 'One', subject: '', teacher: '', type: 'classroom' as const },
    { roomId: 'B', name: 'Two', subject: '', teacher: '', type: 'classroom' as const },
  ];

  function renderPreview(errors: string[], onApply = vi.fn()) {
    render(
      <ImportPreview
        fileName="term2.csv"
        check={{
          assignments: [
            { ...current[0], teacher: 'Teacher A' },
            { ...current[1], roomId: 'C' },
          ],
          lines: [2, 3],
          errors,
        }}
        current={current}
        presetName="Term 2"
        applying={false}
        error={null}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    return onApply;
  }

  it('shows what will change, and applies a clean file', async () => {
    const onApply = renderPreview([]);
    expect(screen.getByText('1 get a name')).toBeInTheDocument();
    expect(screen.getByText('1 change')).toBeInTheDocument();
    expect(screen.getByText('1 lose their name')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("lists every problem and can't be applied while there are any", () => {
    renderPreview(['Row 14: "G-R999" is not a room on the map.']);
    expect(screen.getByText('Row 14: "G-R999" is not a room on the map.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });
});

describe('RoomEditor', () => {
  const list = [
    { roomId: '1-R003', name: 'Art', subject: '', teacher: '', type: 'classroom' as const },
    { roomId: 'G-R030', name: 'PYP3 B', subject: '', teacher: '', type: 'classroom' as const },
  ];
  const row = {
    id: 'G-R030',
    floor: 'G',
    kind: 'room' as const,
    name: 'PYP3 B',
    subject: '',
    teacher: '',
    type: 'classroom' as const,
  };

  it('saves the whole term with only this room changed', async () => {
    const save = mutation();
    hooks.useSaveAssignments.mockReturnValue(save);
    render(<RoomEditor row={row} presetId="t1" assignments={list} onDone={() => {}} />);
    await userEvent.type(screen.getByLabelText('Teacher', { exact: false }), 'Teacher A');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(save.mutate).toHaveBeenCalledTimes(1);
    expect(save.mutate.mock.calls[0][0]).toEqual({
      presetId: 't1',
      assignments: [list[0], { ...list[1], teacher: 'Teacher A' }],
    });
  });

  it('refuses a name another room has, and asks before leaving a room unnamed', async () => {
    const save = mutation();
    hooks.useSaveAssignments.mockReturnValue(save);
    render(<RoomEditor row={row} presetId="t1" assignments={list} onDone={() => {}} />);
    const name = screen.getByLabelText('Name', { exact: false });

    await userEvent.clear(name);
    await userEvent.type(name, 'art');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      screen.getByText(`Two rooms can't share a name: "art" is already used by 1-R003.`),
    ).toBeInTheDocument();

    await userEvent.clear(name);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Leave PYP3 B without a name?');
    expect(save.mutate).not.toHaveBeenCalled();
  });
});
