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
    title: 'School calendar',
    sections: [
      {
        path: 'school-week',
        title: 'School week and periods',
        description: 'School days and bookable periods',
        icon: 'clock',
      },
      {
        path: 'bell-times',
        title: 'Upload bell times',
        description: 'Replace periods from a CSV file',
        icon: 'download',
      },
      {
        path: 'terms',
        title: 'Terms and holidays',
        description: 'The school year and days off',
        icon: 'calendar',
      },
      {
        path: 'blackouts',
        title: 'Venue blackouts',
        description: 'Days a venue can’t be booked',
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
        description: 'Expiry, pinning, scheduled and expired posts',
        icon: 'megaphone',
      },
      {
        path: 'collab',
        title: 'Collab',
        description: 'Team rules and the skills list',
        icon: 'users',
      },
      {
        path: 'volunteering',
        title: 'Volunteering',
        description: 'Approval, categories, SUPW targets',
        icon: 'heart',
      },
      {
        path: 'venues',
        title: 'Venues',
        description: 'Who can book, when, and each venue’s rules',
        icon: 'calendar',
      },
      {
        path: 'map',
        title: 'Map',
        description: 'Floor plans, rooms and pin positions',
        icon: 'map',
      },
      {
        path: 'report-categories',
        title: 'Fix-it categories',
        description: 'What can be reported and who gets it',
        icon: 'flag',
      },
      {
        path: 'reports',
        title: 'Fix-it reports',
        description: 'Every open report, urgent first',
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
        description: 'Reported content and hidden posts',
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
        description: 'Tell everyone at once',
        icon: 'megaphone',
      },
      {
        path: 'staff-email',
        title: 'Staff email',
        description: 'Digest time, and who gets email',
        icon: 'mail',
      },
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
        path: 'features',
        title: 'Feature switches',
        description: 'Turn whole features off and on',
        icon: 'settings',
      },
      {
        path: 'branding',
        title: 'Branding',
        description: 'School name, logo and colour',
        icon: 'image',
      },
      {
        path: 'maintenance',
        title: 'Maintenance banner',
        description: 'A notice on every screen',
        icon: 'alert',
      },
      {
        path: 'sign-in',
        title: 'Sign-in',
        description: 'School email domain, staff pattern, dev accounts',
        icon: 'user',
      },
      {
        path: 'export',
        title: 'Data export',
        description: 'CSV files of users, hours, bookings, reports',
        icon: 'download',
      },
      {
        path: 'deletion',
        title: 'Data deletion',
        description: 'Delete someone’s personal data on request',
        icon: 'trash',
      },
      { path: 'audit', title: 'Audit log', description: 'Who changed what', icon: 'layers' },
    ],
  },
];
