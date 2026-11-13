// Motion logic that isn't CSS: which way a screen change goes, and how lists
// decide which items animate. (Durations are 0 in tests: no styles are
// loaded, so removals are immediate here.)
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { transitionKind } from '@/app/screenTransitions';
import { useListMotion } from './useListMotion';

describe('transitionKind', () => {
  it('slides forward when drilling into a detail page, and back out again', () => {
    expect(transitionKind('/collab', '/collab/123')).toBe('forward');
    expect(transitionKind('/collab/123', '/collab')).toBe('back');
    expect(transitionKind('/', '/announcements')).toBe('forward');
    expect(transitionKind('/reports/9', '/map')).toBe('back');
  });

  it('cross-fades between tabs and between screens at the same depth', () => {
    expect(transitionKind('/map', '/volunteer')).toBe('fade');
    expect(transitionKind('/collab/1', '/book')).toBe('fade');
    expect(transitionKind('/admin/users', '/admin/venues')).toBe('fade');
  });
});

function List({ items }: { items: string[] | undefined }) {
  const rows = useListMotion(items, (item) => item);
  return (
    <ul>
      {rows.map(({ key, motion }) => (
        <li key={key} data-motion={motion}>
          {key}
        </li>
      ))}
    </ul>
  );
}

describe('useListMotion', () => {
  it("doesn't animate the first load, only items that arrive later", () => {
    const { rerender } = render(<List items={undefined} />);
    rerender(<List items={['a', 'b']} />);
    expect(screen.getByText('a')).toHaveAttribute('data-motion', '');

    act(() => rerender(<List items={['c', 'a', 'b']} />));
    expect(screen.getByText('c')).toHaveAttribute('data-motion', 'enter');
    expect(screen.getByText('b')).toHaveAttribute('data-motion', '');
  });

  it('drops removed items (straight away when nothing animates)', () => {
    const { rerender } = render(<List items={['a', 'b']} />);
    act(() => rerender(<List items={['a']} />));
    expect(screen.queryByText('b')).not.toBeInTheDocument();
  });
});
