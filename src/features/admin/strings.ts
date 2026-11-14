// Every piece of explaining text in the admin dashboard, in one place, so the
// wording can be read, checked and changed without opening each screen:
//   menuSubtitles  the grey line under each section in the admin menu, like
//                  the subtitle under a category in iPhone Settings
//   pageIntros     the line under each section's title, at the top of it
//   footnotes      small print under a setting or a group that needs it
//
// House style: written for a school administrator, in plain words, one
// sentence each; menu subtitles stay under about 60 characters. Each sentence
// says what the app really does. Where that comes from a database rule rather
// than the screen, the comment beside it names the rule, so the copy can be
// checked when the rule changes. Labels on buttons and fields stay with the
// screens; this file is only the explaining.

/** Keys are the section addresses under /admin (see ./sections.ts). */
export const menuSubtitles = {
  overview: 'What needs attention, and how the app is being used',
  users: 'Change someone’s role or grade, or pause their posting',
  grades: 'The grades the school uses, and the sections in each',
  classes: 'Who teaches whom, for limiting teachers’ announcements',
  import: 'Add or update students and staff from a spreadsheet',
  rollover: 'At the end of the year, move every student up a grade',
  'staff-emails': 'Addresses that sign in as teachers, not students',
  responsibilities: 'Who handles repairs, IT, venue bookings and SUPW hours',
  'school-week': 'School days, and the periods venues are booked by',
  'bell-times': 'Replace the periods from a spreadsheet of bell times',
  terms: 'Term dates, and holidays when nothing can be booked',
  blackouts: 'Extra days when one venue, or all of them, can’t be booked',
  announcements: 'Default expiry, and every post, including scheduled ones',
  collab: 'Team size, supervising teachers and the skills list',
  volunteering: 'Teacher approval, event categories and SUPW hour targets',
  venues: 'Who can book, when, and each venue’s own rules',
  map: 'Floor plans, rooms and where each room’s pin sits',
  'report-categories': 'What can be reported, and which team gets each kind',
  reports: 'Every open fix-it report, urgent ones first',
  moderation: 'Reported posts, and posts staff have hidden or removed',
  emergency: 'Alert everyone at once, for emergencies and drills',
  'staff-email': 'Who gets email, and when the daily digest goes out',
  outbox: 'Emails and phone notifications waiting to be sent',
  features: 'Turn whole parts of the app off and on',
  branding: 'School name, logo and colour',
  maintenance: 'A notice at the top of every screen',
  'sign-in': 'Who can sign in, and who becomes a teacher',
  export: 'Download people, hours, bookings or reports as a spreadsheet',
  deletion: 'Remove someone’s personal data when they ask',
  audit: 'Who changed what, and when',
} as const;

export type AdminSectionPath = keyof typeof menuSubtitles;

/** The line under each section's title. */
export const pageIntros: Record<AdminSectionPath, string> = {
  overview: 'What needs attention, and how the app is being used.',
  users: 'Roles, grades, responsibilities and posting.',
  grades: 'The grades the school uses and the sections in each.',
  classes: 'Who teaches whom. Used to limit who teachers can announce to.',
  import: 'Add or update students and staff from a CSV file.',
  rollover: 'Move every student up a grade at the end of the school year.',
  'staff-emails': 'Email addresses that belong to teachers.',
  responsibilities: 'Who gets fix-it reports, approves venue bookings and confirms SUPW hours.',
  'school-week': 'School days, and the periods venues can be booked by.',
  'bell-times': 'Replace the periods of whole weekdays from a CSV file.',
  terms: 'The school year, and days off.',
  blackouts: 'Days a venue can’t be booked, and why.',
  announcements: 'Defaults, pinning, and every post including scheduled and expired ones.',
  collab: 'Team rules and the skills students choose from.',
  volunteering: 'Approval, categories and SUPW targets.',
  venues: 'Who can book, when, and the rules for each venue.',
  map: 'Floor plans, rooms and where each room’s pin sits.',
  'report-categories': 'What can be reported, and which team gets each kind.',
  reports: 'Every open report, urgent first, oldest first.',
  moderation: 'Reported, hidden and removed content.',
  emergency: 'Tell everyone at once. For real emergencies and drills only.',
  'staff-email': 'When the digest goes out, and who gets email.',
  // Q7 and Q8 in docs/OPEN_QUESTIONS.md: nothing is sent until a provider is added.
  outbox: 'Waiting to be sent: no email or phone notification service is connected yet.',
  features: 'Turn whole features off and on. Admins always see everything.',
  branding: 'The school’s name, logo and colour.',
  maintenance: 'A notice at the top of every screen.',
  'sign-in': 'Who can sign in, and who becomes staff.',
  export: 'Download a CSV file to open in a spreadsheet.',
  deletion: 'Delete someone’s personal data when they ask, keeping the school’s records.',
  audit: 'Who changed what. Shows the latest 200 matches.',
};

/** Small print under settings and groups, by section. One sentence each. */
export const footnotes = {
  users: {
    // Report routing: report_categories.responsibility; bookings: venues
    // responsibility; hours: can_confirm_hours().
    responsibilities:
      'Facilities and IT get the fix-it reports sent to them, Venues approve bookings, and SUPW confirm volunteering hours.',
    notStaff: 'Responsibilities are for teachers and admins.',
    pausePosting:
      'They can still read everything, but can’t post announcements, collab posts or requests, events or fix-it reports until then, and they see why.',
    roleChange: 'The change is recorded in the audit log.',
  },
  grades: {
    inUse: 'A grade that isn’t in use stays on old records but can’t be chosen any more.',
  },
  classes: {
    anyGrade:
      'Turn this off once classes are set up, so teachers can announce only to the grades and sections they teach.',
  },
  import: {
    template:
      'One person per line: name, email, role (student or teacher), and for students their grade and section; make admins one at a time under Users.',
    afterImport:
      'New people are set up the first time they sign in, and importing a corrected file again simply updates the rows already done.',
  },
  rollover: {
    whatHappens:
      'Archived students keep their history (SUPW hours, reports, projects) but can’t sign in; sections stay the same (10 A becomes 11 A); class lists aren’t changed, so set up next year’s classes afterwards.',
    recorded: 'The rollover is recorded in the audit log.',
  },
  staffEmails: {
    // promote_listed_staff() runs when an address is added; nothing runs when
    // one is removed.
    list: 'Adding an address makes that person a teacher, straight away if they already have an account; removing it doesn’t change their role back (do that under Users).',
  },
  responsibilities: {
    facilities: 'Gets fix-it reports in the categories sent to Facilities (see Fix-it categories).',
    it: 'Gets fix-it reports in the categories sent to IT (see Fix-it categories).',
    venues: 'Approves or rejects venue bookings.',
    supw: 'Confirms SUPW hours for any event and exports the totals.',
  },
  schoolWeek: {
    periods:
      'Venue bookings follow these periods on the days they run, and everyone sees them under Bell times.',
    overlap: 'Periods on the same day can’t overlap, so give a short day its own set.',
    days: 'Only these days appear in the booking calendar and on Bell times.',
  },
  bellTimes: {
    template: (columns: string) =>
      `It holds today’s periods, one line per period per weekday, with the columns ${columns}; times look like 07:30, order 1 is the day’s first period, and a weekday left out keeps its periods.`,
    after: 'Bookings made before stay as they were.',
  },
  terms: {
    // school/logic.ts: outside every term is a warning, not a block.
    terms:
      'Days outside every term are marked “Outside term time” when booking, but can still be booked.',
    holidays: 'Single days or breaks; no venue can be booked on them.',
  },
  blackouts: {
    list: 'New requests for these days are refused, and bookings already made stay.',
  },
  announcements: {
    defaultExpiry:
      'Fills in the expiry on new announcements, which the author can change; leave it empty for no expiry.',
  },
  collab: {
    requiresTeacher: 'When on, students must choose a supervising teacher before they can post.',
    // collab_posts_check_rules() only checks a post when it's made or resized.
    maxTeam: 'This counts the owner, and teams already bigger than this keep their size.',
  },
  volunteering: {
    // volunteer_events_before_insert(); can_confirm_hours().
    studentApproval:
      'When off, events students create go live at once, and only SUPW staff or an admin can confirm their hours.',
    categories: 'Students filter events by these on the Volunteer tab.',
    targets:
      'Students see their progress towards their grade’s target; leave a grade empty for no target.',
  },
  venues: {
    studentsCanRequest:
      'Students name a supervising teacher, who confirms the request before venue staff see it.',
    customTimes:
      'When on, people can also pick any start and end time, not just periods, within each venue’s own limits.',
    // booking_period_problem(): after school starts at the day's last period
    // end, rounded up to a whole block.
    afterSchoolBlocks:
      'After the last period, venues are booked in blocks of this length, starting when that day’s last period ends.',
    remindWhen: 'Remind venue staff about a waiting request when:',
    // venue_reminders(): last_reminder_at keeps it to once a day.
    reminders: 'Each waiting request gets at most one reminder a day.',
    limits: 'Booking limits (leave empty for no limit)',
    needsApproval: 'Untick for small rooms: free slots are then booked straight away.',
    bookable: 'Untick to retire it: it leaves the calendar, and existing bookings stay.',
  },
  reportCategories: {
    // report_votes_auto_urgent(); an urgent report's email goes out at once.
    autoUrgent:
      'When a report gets this many “me too”s it becomes urgent and the team is emailed straight away; leave empty to turn this off.',
    sendTo: 'Everyone holding this responsibility is notified.',
    inUse: 'Retired categories stay on old reports but can’t be chosen.',
  },
  staffEmail: {
    // email_digest_due(): checked each time the sender runs (hourly).
    digestTime: 'Staff on the digest get one email a day, soon after this time.',
    // notify(): no preference = email only if they hold a responsibility;
    // urgent ones skip the digest; in-app and phone notifications always go.
    whoGetsEmail:
      '“Default” is a daily digest for staff who hold a responsibility and no email for others; urgent items skip the digest, and in-app and phone notifications aren’t affected.',
  },
  signIn: {
    // handle_new_user(): the domain itself or any subdomain.
    domain: 'Only email addresses on this domain, or its subdomains, can create an account.',
    pattern:
      'For advanced use: addresses matching this pattern (a regular expression) become teachers when they first sign in.',
    // handle_new_user() checks this only when an account is first made.
    devAccounts:
      'Turning this off stops new @dev.local test accounts being made, but the ones that already exist can still sign in.',
  },
  maintenance: {
    show: 'Everyone sees it, signed in or not.',
    until:
      'It disappears on its own at this time; leave it empty to keep it until you switch it off.',
  },
  features: {
    off: 'Off hides the tab and tile and stops anyone but admins adding anything new; nothing is deleted.',
  },
  map: {
    planImage:
      'Upload a plan (SVG, PNG, JPEG or WebP, up to 5 MB) and its address and size fill in for you; pins keep their pixel positions, so move them if the new plan is a different size.',
  },
  emergency: {
    alert:
      'Everyone with the app is notified immediately, and it stays pinned at the top of every feed.',
    procedure: 'In a real emergency, follow the school’s own procedure first.',
  },
  deletion: {
    steps: [
      'Their name becomes “Deleted user” and their email is removed.',
      'Photos and files they uploaded are deleted.',
      'Their notifications, settings and class lists go, and they can’t sign in.',
      'Kept: confirmed SUPW hours, reports, posts and bookings, under “Deleted user”.',
    ],
    auditNote: 'Older audit log entries can’t be changed, so a name may still appear there.',
  },
  export: {
    users: 'Everyone, with role, grade, section, responsibilities and status.',
    supw: 'Every student’s confirmed hours and events attended.',
    bookings: 'Every booking in those dates, with who asked, the decision and why.',
    reports: 'Every report made in those dates, with its status and who handled it.',
  },
} as const;
