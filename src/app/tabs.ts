// The bottom tabs from the design: Home, Map, Volunteer, Collab, Book, plus
// Approvals for staff. A tab also lights up for the screens reached from it
// (Projects and Announcements belong to Home, fix-it reports to Map).
import type { IconName } from '@/components/Icon';
import type { CurrentUser } from '@/features/auth/api';
import { isStaff } from '@/lib/permissions';

export interface Tab {
  to: string;
  label: string;
  icon: IconName;
  /** Path prefixes that count as "inside" this tab. */
  sections: string[];
}

const everyoneTabs: Tab[] = [
  {
    to: '/',
    label: 'Home',
    icon: 'home',
    sections: ['/announcements', '/projects', '/notifications', '/me', '/search'],
  },
  { to: '/map', label: 'Map', icon: 'map', sections: ['/map', '/reports'] },
  { to: '/volunteer', label: 'Volunteer', icon: 'heart', sections: ['/volunteer'] },
  { to: '/collab', label: 'Collab', icon: 'users', sections: ['/collab'] },
  { to: '/book', label: 'Book', icon: 'calendar', sections: ['/book'] },
];

const approvalsTab: Tab = {
  to: '/approvals',
  label: 'Approvals',
  icon: 'approvals',
  sections: ['/approvals', '/admin'],
};

/** Students see five tabs; teachers and admins also get Approvals. */
export function tabsFor(user: CurrentUser): Tab[] {
  return isStaff(user) ? [...everyoneTabs, approvalsTab] : everyoneTabs;
}

export function isTabActive(tab: Tab, pathname: string): boolean {
  if (tab.to === '/' && pathname === '/') return true;
  return tab.sections.some((section) => pathname === section || pathname.startsWith(`${section}/`));
}
