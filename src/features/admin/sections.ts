// The admin dashboard's menu: every section, in groups. The side menu (laptop),
// the menu screen (phone) and the overview's links all read this list, so a
// new section only needs adding here, in ./routes.tsx, and its subtitle in
// ./strings.ts.
import type { IconName } from '@/components/Icon';
import { menuSubtitles, type AdminSectionPath } from './strings';

export interface AdminSection {
  /** The address under /admin, e.g. 'users' → /admin/users. */
  path: AdminSectionPath;
  title: string;
  /** The grey line under the title in the menu (from ./strings.ts). */
  description: string;
  icon: IconName;
}

export interface AdminGroup {
  title: string;
  sections: AdminSection[];
}

export const adminGroups: AdminGroup[] = [
  {
    title: 'Overview',
    sections: [
      {
        path: 'overview',
        title: 'Overview',
        description: menuSubtitles.overview,
        icon: 'layers',
      },
    ],
  },
  {
    title: 'People',
    sections: [
      {
        path: 'users',
        title: 'Users',
        description: menuSubtitles.users,
        icon: 'users',
      },
      {
        path: 'grades',
        title: 'Grades and sections',
        description: menuSubtitles.grades,
        icon: 'layers',
      },
      {
        path: 'classes',
        title: 'Classes',
        description: menuSubtitles.classes,
        icon: 'folder',
      },
      {
        path: 'import',
        title: 'Import people',
        description: menuSubtitles.import,
        icon: 'download',
      },
      {
        path: 'rollover',
        title: 'Year-end rollover',
        description: menuSubtitles.rollover,
        icon: 'chevronRight',
      },
      {
        path: 'staff-emails',
        title: 'Staff emails',
        description: menuSubtitles['staff-emails'],
        icon: 'mail',
      },
      {
        path: 'responsibilities',
        title: 'Responsibilities',
        description: menuSubtitles.responsibilities,
        icon: 'shield',
      },
    ],
  },
  {
    title: 'School calendar',
    sections: [
      {
        path: 'school-week',
        title: 'School week and periods',
        description: menuSubtitles['school-week'],
        icon: 'clock',
      },
      {
        path: 'bell-times',
        title: 'Upload bell times',
        description: menuSubtitles['bell-times'],
        icon: 'download',
      },
      {
        path: 'terms',
        title: 'Terms and holidays',
        description: menuSubtitles.terms,
        icon: 'calendar',
      },
      {
        path: 'blackouts',
        title: 'Venue blackouts',
        description: menuSubtitles.blackouts,
        icon: 'eyeOff',
      },
    ],
  },
  {
    title: 'Features',
    sections: [
      {
        path: 'announcements',
        title: 'Announcements',
        description: menuSubtitles.announcements,
        icon: 'megaphone',
      },
      {
        path: 'collab',
        title: 'Collab',
        description: menuSubtitles.collab,
        icon: 'users',
      },
      {
        path: 'volunteering',
        title: 'Volunteering',
        description: menuSubtitles.volunteering,
        icon: 'heart',
      },
      {
        path: 'venues',
        title: 'Venues',
        description: menuSubtitles.venues,
        icon: 'calendar',
      },
      {
        path: 'map',
        title: 'Map',
        description: menuSubtitles.map,
        icon: 'map',
      },
      {
        path: 'report-categories',
        title: 'Fix-it categories',
        description: menuSubtitles['report-categories'],
        icon: 'flag',
      },
      {
        path: 'reports',
        title: 'Fix-it reports',
        description: menuSubtitles.reports,
        icon: 'alert',
      },
    ],
  },
  {
    title: 'Moderation',
    sections: [
      {
        path: 'moderation',
        title: 'Moderation',
        description: menuSubtitles.moderation,
        icon: 'eyeOff',
      },
    ],
  },
  {
    title: 'Notifications',
    sections: [
      {
        path: 'emergency',
        title: 'Emergency broadcast',
        description: menuSubtitles.emergency,
        icon: 'megaphone',
      },
      {
        path: 'staff-email',
        title: 'Staff email',
        description: menuSubtitles['staff-email'],
        icon: 'mail',
      },
      {
        path: 'outbox',
        title: 'Outbox',
        description: menuSubtitles.outbox,
        icon: 'bell',
      },
    ],
  },
  {
    title: 'System',
    sections: [
      {
        path: 'features',
        title: 'Feature switches',
        description: menuSubtitles.features,
        icon: 'settings',
      },
      {
        path: 'branding',
        title: 'Branding',
        description: menuSubtitles.branding,
        icon: 'image',
      },
      {
        path: 'maintenance',
        title: 'Maintenance banner',
        description: menuSubtitles.maintenance,
        icon: 'alert',
      },
      {
        path: 'sign-in',
        title: 'Sign-in',
        description: menuSubtitles['sign-in'],
        icon: 'user',
      },
      {
        path: 'export',
        title: 'Data export',
        description: menuSubtitles.export,
        icon: 'download',
      },
      {
        path: 'deletion',
        title: 'Data deletion',
        description: menuSubtitles.deletion,
        icon: 'trash',
      },
      { path: 'audit', title: 'Audit log', description: menuSubtitles.audit, icon: 'layers' },
    ],
  },
];
