// Toasts: they appear, screen readers hear them, and they go away on their own.
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissToast, getToasts, showToast, TOAST_MS } from '@/lib/toast';
import { Toaster } from './Toaster';

describe('Toaster', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // The toast list lives outside React; empty it between tests.
    for (const toast of getToasts()) dismissToast(toast.id);
    vi.useRealTimers();
  });

  it('shows a success toast, announces it politely, then dismisses it', () => {
    render(<Toaster />);
    act(() => {
      showToast('Booking requested');
    });

    // On screen…
    expect(screen.getAllByText('Booking requested').length).toBeGreaterThan(0);
    // …and in the live region screen readers listen to.
    expect(screen.getByRole('status')).toHaveTextContent('Booking requested');

    act(() => {
      vi.advanceTimersByTime(TOAST_MS.success);
    });
    expect(screen.queryByText('Booking requested')).not.toBeInTheDocument();
  });

  it('announces errors assertively, and the Dismiss button closes one early', () => {
    render(<Toaster />);
    act(() => {
      showToast("Couldn't save, try again.", 'error');
    });
    expect(screen.getByTestId('toast-errors')).toHaveTextContent("Couldn't save, try again.");

    act(() => {
      screen.getByRole('button', { name: 'Dismiss' }).click();
    });
    expect(screen.queryByText("Couldn't save, try again.")).not.toBeInTheDocument();
  });

  it('keeps at most three on screen', () => {
    render(<Toaster />);
    act(() => {
      ['One', 'Two', 'Three', 'Four'].forEach((message) => showToast(message));
    });
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(3);
    expect(screen.queryByText('One')).not.toBeInTheDocument();
  });
});
