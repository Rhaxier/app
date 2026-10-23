// The admin dashboard's menu: every section, in groups. The side menu (laptop),
// the menu screen (phone) and the overview's links all read this list, so a
// new section only needs adding here and in ./routes.tsx.
import type { IconName } from '@/components/Icon';

export interface AdminSection {
  /** The address under /admin, e.g. 'users' → /admin/users. */
  path: string;
  title: string;
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
        description: 'What needs attention, and how the app is used',
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
        description: 'Roles, grades, responsibilities, suspensions',
        icon: 'users',
      },
      {
        path: 'grades',
        title: 'Grades and sections',
        description: 'The grades in use and their sections',
        icon: 'layers',
      },
      {
        path: 'classes',
        title: 'Classes',
        description: 'Who teaches whom',
        icon: 'folder',
      },
      {
        path: 'import',
        title: 'Import people',
        description: 'Add or update people from a CSV file',
        icon: 'download',
      },
      {
        path: 'rollover',
        title: 'Year-end rollover',
        description: 'Move every student up a grade',
        icon: 'chevronRight',
      },
      {
        path: 'staff-emails',
        title: 'Staff emails',
        description: 'Who becomes a teacher at sign-in',
        icon: 'mail',
      },
      {
        path: 'responsibilities',
        title: 'Responsibilities',
        description: 'Facilities, IT, venues, SUPW',
        icon: 'shield',
      },
    ],
  },
  {
    title: 'Features',
    sections: [
      {
        path: 'venues',
        title: 'Venues',
        description: 'Bookable places and their rules',
        icon: 'calendar',
      },
      {
        path: 'map',
        title: 'Map',
        description: 'Floors, rooms and pin positions',
        icon: 'map',
      },
      {
        path: 'reports',
        title: 'Fix-it reports',
        description: 'Every open report, urgent first',
        icon: 'flag',
      },
      {
        path: 'routes',
        title: 'Report routes',
        description: 'Which team gets each fix-it category',
        icon: 'flag',
      },
    ],
  },
  {
    title: 'Moderation',
    sections: [
      {
        path: 'moderation',
        title: 'Moderation',
        description: 'Reported content and hidden posts',
        icon: 'eyeOff',
      },
    ],
  },
  {
    title: 'Notifications',
    sections: [
      {
        path: 'outbox',
        title: 'Outbox',
        description: 'Emails and pushes waiting to be sent',
        icon: 'bell',
      },
    ],
  },
  {
    title: 'System',
    sections: [
      {
        path: 'settings',
        title: 'Settings',
        description: 'School name, sign-in, booking slots',
        icon: 'settings',
      },
      { path: 'audit', title: 'Audit log', description: 'Who changed what', icon: 'layers' },
    ],
  },
];
