// The Approvals tab is for staff only. (The database also refuses students
// the data behind it; this checks the UI hides the tab.)
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser, renderWithProviders, teacher } from '@/test/utils';
import type { CurrentUser } from '@/features/auth/api';
import { SearchOverlayProvider } from '@/features/search/SearchOverlayProvider';
import { TabBar as Bar } from './TabBar';

// The tab bar's search button opens the search overlay, which lives in the app layout.
function TabBar() {
  return (
    <SearchOverlayProvider>
      <Bar />
    </SearchOverlayProvider>
  );
}
import { isTabActive, tabsFor } from './tabs';

// Replace the real "who is signed in" hook with one the test controls.
let signedIn: CurrentUser = makeUser();
vi.mock('@/features/auth/hooks', () => ({ useCurrentUser: () => signedIn }));

describe('TabBar', () => {
  beforeEach(() => {
    signedIn = makeUser();
  });

  it('shows students the five tabs from the design, without Approvals', () => {
    renderWithProviders(<TabBar />);
    const tabs = within(screen.getByRole('list')).getAllByRole('link');
    expect(tabs.map((link) => link.textContent)).toEqual([
      'Home',
      'Map',
      'Volunteer',
      'Collab',
      'Book',
    ]);
  });

  it('has the round search button beside the tabs, which opens search', async () => {
    renderWithProviders(<TabBar />);
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search rooms, events, posts')).toHaveFocus();
  });

  it('adds an Approvals tab for teachers', () => {
    signedIn = teacher;
    renderWithProviders(<TabBar />);
    expect(screen.getByRole('link', { name: 'Approvals' })).toHaveAttribute('href', '/approvals');
  });

  it('adds an Approvals tab for admins', () => {
    signedIn = makeUser({ role: 'admin' });
    renderWithProviders(<TabBar />);
    expect(screen.getByRole('link', { name: 'Approvals' })).toBeInTheDocument();
  });

  it('marks the current tab, including screens reached from it', () => {
    renderWithProviders(<TabBar />, { route: '/projects/123' });
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Map' })).not.toHaveAttribute('aria-current');
  });
});

describe('isTabActive', () => {
  const [home, map] = tabsFor(makeUser());

  it('treats fix-it report pages as part of Map', () => {
    expect(isTabActive(map, '/reports/abc')).toBe(true);
    expect(isTabActive(home, '/reports/abc')).toBe(false);
  });

  it('does not match look-alike paths', () => {
    expect(isTabActive(map, '/mapping')).toBe(false);
  });
});

describe('tabsFor with feature switches', () => {
  it('leaves out the tabs of switched-off features', () => {
    const collabOff = (feature: string) => feature !== 'collab';
    expect(tabsFor(makeUser(), collabOff).map((tab) => tab.label)).toEqual([
      'Home',
      'Map',
      'Volunteer',
      'Book',
    ]);
  });
});
