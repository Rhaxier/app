// The "Add to Home Screen" hint on screen: it shows in iPhone Safari, closes
// with its button, and stays closed on that device.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INSTALL_HINT_KEY } from '@/lib/install';
import { InstallHint } from './InstallHint';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

describe('InstallHint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('is not shown in other browsers (the test browser is one)', () => {
    render(<InstallHint />);
    expect(screen.queryByRole('complementary', { name: 'Install the app' })).toBeNull();
  });

  it('shows the steps in iPhone Safari, and stays closed once closed', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_SAFARI);
    const { unmount } = render(<InstallHint />);
    expect(screen.getByText('To install: tap Share, then Add to Home Screen')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hide this tip' }));
    // It fades out, then goes.
    await waitFor(() =>
      expect(screen.queryByText('To install: tap Share, then Add to Home Screen')).toBeNull(),
    );
    expect(localStorage.getItem(INSTALL_HINT_KEY)).toBe('true');

    // Another screen (Home after sign-in) doesn't show it again.
    unmount();
    render(<InstallHint />);
    expect(screen.queryByRole('complementary', { name: 'Install the app' })).toBeNull();
  });
});
