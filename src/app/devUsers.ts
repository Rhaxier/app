// The seeded test accounts (supabase/seed.sql), for the dev role switcher.
// Fake people on the fake @dev.local domain; they only work while
// app_settings.allow_dev_accounts is on.
export const DEV_PASSWORD = 'devpass123';

export interface DevUser {
  email: string;
  name: string;
  note: string;
}

export const devUserGroups: { title: string; users: DevUser[] }[] = [
  {
    title: 'Students',
    users: [
      {
        email: 'student.g8.a@dev.local',
        name: 'Student Grade 8 A',
        note: 'Grade 8 · owns a collab post',
      },
      { email: 'student.g8.b@dev.local', name: 'Student Grade 8 B', note: 'Grade 8' },
      {
        email: 'student.g10.a@dev.local',
        name: 'Student Grade 10 A',
        note: 'Grade 10 · has projects and a collab post',
      },
      { email: 'student.g10.b@dev.local', name: 'Student Grade 10 B', note: 'Grade 10' },
      {
        email: 'student.g12.a@dev.local',
        name: 'Student Grade 12 A',
        note: 'Grade 12 · created an event awaiting approval',
      },
      { email: 'student.g12.b@dev.local', name: 'Student Grade 12 B', note: 'Grade 12' },
    ],
  },
  {
    title: 'Teachers',
    users: [
      { email: 'teacher.a@dev.local', name: 'Teacher A', note: 'SUPW coordinator' },
      { email: 'teacher.b@dev.local', name: 'Teacher B', note: 'No responsibilities' },
      { email: 'teacher.c@dev.local', name: 'Teacher C', note: 'No responsibilities' },
    ],
  },
  {
    title: 'Admins',
    users: [
      {
        email: 'admin.facilities@dev.local',
        name: 'Admin Facilities',
        note: 'Facilities + IT: gets fix-it reports',
      },
      { email: 'admin.venues@dev.local', name: 'Admin Venues', note: 'Venues: approves bookings' },
      { email: 'admin.plain@dev.local', name: 'Admin Plain', note: 'No responsibilities' },
    ],
  },
];
