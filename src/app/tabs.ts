// The bottom tabs from the design: Home, Map, Volunteer, Collab, Book, plus
// Approvals for staff. A tab also lights up for the screens reached from it
// (Projects and Announcements belong to Home, fix-it reports to Map).
import type { IconName } from '@/components/Icon';
import type { CurrentUser } from '@/features/auth/api';
import type { FeatureName } from '@/features/settings/api';
import { isStaff } from '@/lib/permissions';

export interface Tab {
  to: string;
  label: string;
  icon: IconName;
  /** Path prefixes that count as "inside" this tab. */
  sections: string[];
  /** Hidden (except for admins) while this feature is switched off. */
  feature?: FeatureName;
}

const everyoneTabs: Tab[] = [
  {
    to: '/',
    label: 'Home',
    icon: 'home',
    sections: ['/announcements', '/projects', '/notifications', '/me', '/search'],
  },
  { to: '/map', label: 'Map', icon: 'map', sections: ['/map', '/reports'], feature: 'map' },
  {
    to: '/volunteer',
    label: 'Volunteer',
    icon: 'heart',
    sections: ['/volunteer'],
    feature: 'volunteering',
  },
  { to: '/collab', label: 'Collab', icon: 'users', sections: ['/collab'], feature: 'collab' },
  { to: '/book', label: 'Book', icon: 'calendar', sections: ['/book'], feature: 'venues' },
];

const approvalsTab: Tab = {
  to: '/approvals',
  label: 'Approvals',
  icon: 'approvals',
  sections: ['/approvals', '/admin'],
};

/**
 * Students see five tabs; teachers and admins also get Approvals. A tab whose
 * feature is switched off is left out (`visible` says which features show).
 */
export function tabsFor(
  user: CurrentUser,
  visible: (feature: FeatureName) => boolean = () => true,
): Tab[] {
  const tabs = isStaff(user) ? [...everyoneTabs, approvalsTab] : everyoneTabs;
  return tabs.filter((tab) => !tab.feature || visible(tab.feature));
}

/** The tab a screen belongs to, whoever is looking (used for screen transitions). */
export function tabOf(pathname: string): Tab | undefined {
  return [...everyoneTabs, approvalsTab].find((tab) => isTabActive(tab, pathname));
}

export function isTabActive(tab: Tab, pathname: string): boolean {
  if (tab.to === '/' && pathname === '/') return true;
  return tab.sections.some((section) => pathname === section || pathname.startsWith(`${section}/`));
}
