// The bottom sheet keeps focus where the person is working: typing into a
// field inside it must not bounce focus out, and Tab stays inside the sheet.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Sheet } from './Sheet';

function SheetWithField() {
  const [note, setNote] = useState('');
  return (
    <>
      <button type="button">Behind the sheet</button>
      {/* A new onClose function on every render, as parents usually write it. */}
      <Sheet open title="Add a note" onClose={() => setNote('')}>
        <label htmlFor="note">Note</label>
        <input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button">Save</button>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('keeps focus in a field while typing, one key at a time', async () => {
    render(<SheetWithField />);
    await userEvent.click(screen.getByLabelText('Note'));
    await userEvent.keyboard('hello');
    expect(screen.getByLabelText('Note')).toHaveValue('hello');
    expect(screen.getByLabelText('Note')).toHaveFocus();
  });

  it('keeps Tab inside the sheet', async () => {
    render(<SheetWithField />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Behind the sheet' })).not.toHaveFocus();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes on Escape', async () => {
    let closed = false;
    render(
      <Sheet open title="T" onClose={() => (closed = true)}>
        <p>Body</p>
      </Sheet>,
    );
    await userEvent.keyboard('{Escape}');
    expect(closed).toBe(true);
  });
});
