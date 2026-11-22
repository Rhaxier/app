// How wide each screen may grow on a tablet or laptop. On a phone every
// screen is the same 480px column, whatever this says.
//
//   reading  720px: text and forms. Longer lines are hard to read, and a
//            form's fields shouldn't stretch across a laptop screen.
//   page     1160px: lists of cards (two or three across), two-column detail
//            screens, the map
//   wide     the staff desk view and the admin dashboard, which have tables,
//            side menus and editors
//
// One list here, rather than a setting on each screen, so the rule is easy
// to read and change in one place.
export type ScreenWidth = 'reading' | 'page' | 'wide';

const readingScreens = new Set([
  '/me',
  '/notifications',
  '/notifications/settings',
  '/search',
  '/bell-times',
  '/book/request',
]);

export function screenWidth(pathname: string): ScreenWidth {
  if (pathname === '/approvals' || pathname === '/admin' || pathname.startsWith('/admin/')) {
    return 'wide';
  }
  const parts = pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  // Every create and edit form: /volunteer/new, /projects/123/edit…
  if (last === 'new' || last === 'edit') return 'reading';
  // One announcement is something to read.
  if (parts[0] === 'announcements' && parts.length === 2) return 'reading';
  return readingScreens.has(pathname) ? 'reading' : 'page';
}
