# Bell times

The school's periods for each weekday: everyone can see them, admins can upload the
whole timetable as a CSV file, and venue booking follows them. Read
[`venues.md`](venues.md) for how booking uses them.

## What it does

- **Bell times screen** (`/bell-times`, from the "Bell times" card on Home): pick any
  school day and see that date's own periods. Each weekday has its own timings, so a short
  Friday looks different. Holidays and whole-school blackouts are noted. The Home card
  says where today is up to: "Now: Period 2, until 10:30".
- **Upload bell times** (Admin > School calendar): instead of entering periods one by one.
  1. **Download the template.** It holds today's periods, one line per period per weekday:
     `weekday, period_name, start_time, end_time, order`.
  2. **Choose the file.** The database checks every line without saving (a dry run) and
     the preview shows each line's problem: an unknown weekday, a time that isn't a time, a
     period that ends before it starts, two periods on the same day that overlap or share
     an order number.
  3. **Import.** Locked until there are no problems. Every weekday in the file then gets
     exactly the periods in the file, in one transaction; weekdays not in the file keep
     theirs. The audit log records it (`periods_imported`).
- **Periods can't overlap** on the same weekday, whether entered one by one or uploaded,
  so "Period 2 to Period 3" always means the periods in between.
- **Booking follows the bell times.** See `venues.md`: new bookings must start and end on
  that weekday's period boundaries unless an admin allows custom times (Q48).

## Tables and functions

| Name                                      | What it does                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `periods`                                 | Name, start, end, order and the weekdays it runs on (one row can cover Mon–Thu) |
| `admin_import_periods(rows, dry_run)`     | The CSV preview (dry run) and import, all or nothing                            |
| `periods_check_overlap()`                 | Trigger: refuses a period that overlaps another on the same weekday             |
| `booking_period_problem(starts, ends)`    | Why a booking's times don't fit the bell times (null if they do), in words      |
| `app_settings.allow_custom_booking_times` | Off (default): bookings follow the periods. On: any start and end too (Q48)     |

Migrations: `supabase/migrations/20261027120000_period_import.sql` (overlap rule, import)
and `20261027120100_booking_by_periods.sql` (the booking rule and setting). The `periods`
table itself is in `20261023120200_school_calendar.sql`.
Database tests: `supabase/tests/17_bell_times_test.sql`.

## Files to read

1. `supabase/migrations/20261027120000_period_import.sql`: the two passes of checks in
   `admin_import_periods()` (each line alone, then lines against each other).
2. `src/features/school/api.ts` (`importPeriods`), `hooks.ts` (`usePeriodImportPreview`,
   `useImportPeriods`), `logic.ts` (the template, reading the file, `bellTimesOn`,
   `bellTimesSummary`).
3. `src/features/admin/pages/BellTimesImportPage.tsx` and
   `components/PeriodImportPreview.tsx`.
4. `src/features/school/pages/BellTimesPage.tsx` and `components/TodayBellTimes.tsx`.
5. Tests: `src/features/admin/bellTimes.test.tsx`, `src/features/school/school.test.ts`.

## Try it

As **Admin Plain**, open Admin > Upload bell times and download the template. Change
Friday's lines (e.g. 45-minute periods) and delete every other weekday's lines, then
upload it: the preview lists the Friday lines. Import, then open Bell times from Home and
pick a Friday and a Monday: only Friday changed. Book a venue on that Friday: the list
shows the new periods.
