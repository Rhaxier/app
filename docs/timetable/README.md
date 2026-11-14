# School timetable 2026–27 (bell times)

Parsed from `School Timings 2026-27.pdf` (Grades 1–12). The app's single source of truth
for periods is the `periods` table, which admins edit under **Admin › School calendar**
(School week and periods, or **Upload bell times** with one of these files). Venue
bookings are built from those periods, and the database only accepts bookings that match
them (see `docs/features/venues.md`).

| File                           | When                         | Loaded                                                     |
| ------------------------------ | ---------------------------- | ---------------------------------------------------------- |
| `bell-times-2026-27.csv`       | Terms 1 and 2 (the default)  | Yes, into the app's database                               |
| `bell-times-2026-27-term3.csv` | Term 3, Monday–Thursday only | No: upload it when Term 3 starts. Friday keeps its periods |

## Terms 1 and 2

The school runs **Monday to Friday**.

**Monday and Tuesday:** arrival 7:35, registration 7:35–7:45.

| Period   | Time        | Notes                         |
| -------- | ----------- | ----------------------------- |
| Period 1 | 7:45–8:25   | fixed schedule                |
| Period 2 | 8:25–9:15   | Primary ICE                   |
| Period 3 | 9:15–10:05  | Senior ICE                    |
| Break    | 10:05–10:20 | not bookable (a gap)          |
| Period 4 | 10:20–11:10 | Middle ICE                    |
| Period 5 | 11:10–12:00 |                               |
| Period 6 | 12:00–12:50 |                               |
| Lunch    | 12:50–13:20 | not bookable (a gap)          |
| Period 7 | 13:20–14:10 |                               |
| Period 8 | 14:10–15:00 | last period; buses leave 3:15 |

**Wednesday and Thursday:** arrival 7:35, registration 7:35–7:45.

| Period      | Time        | Notes                                                     |
| ----------- | ----------- | --------------------------------------------------------- |
| Period 1    | 7:45–8:25   | fixed schedule                                            |
| Period 2    | 8:25–9:15   |                                                           |
| Break       | 9:15–9:30   | not bookable (a gap)                                      |
| Period 3    | 9:30–10:20  |                                                           |
| Period 4    | 10:20–11:10 |                                                           |
| Period 5    | 11:10–12:00 |                                                           |
| Lunch       | 12:00–12:25 | not bookable (a gap)                                      |
| Period 6    | 12:25–13:15 |                                                           |
| Period 7    | 13:15–14:05 | last lesson; buses leave 2:15                             |
| Collab / PD | 14:15–15:50 | "Willing Wednesdays / Department Collab / PD"; buses 4:00 |

**Friday**

| Period                  | Time        | Notes                          |
| ----------------------- | ----------- | ------------------------------ |
| Period 1 (Registration) | 7:35–7:45   |                                |
| Period 2                | 7:45–8:20   |                                |
| Period 3                | 8:20–8:55   |                                |
| Period 4                | 8:55–9:25   |                                |
| Break                   | 9:25–9:40   | not bookable (a gap)           |
| Period 5                | 9:40–10:10  |                                |
| Period 6                | 10:10–10:40 |                                |
| Period 7                | 10:40–11:10 | last period; buses leave 11:25 |

## Term 3 (Monday–Thursday)

An "extended zero period" (7:40–8:45 Mon/Tue, 7:40–8:40 Wed/Thu) comes first: ASSET/SEEN
practice, CT period or extra classes on Monday and Wednesday; march past or drill on
Tuesday and Thursday. It's in the file as a bookable period. The timetable gives no Term 3
Friday, so the file leaves Friday out and Friday keeps its Term 1–2 periods.

## Assumptions

- **Bookable periods** are the rows the timetable calls "Period N", plus the Wed/Thu
  Collab / PD block and Term 3's extended zero period. Mon–Thu "Registration" (10 minutes,
  not numbered) is not bookable; Friday's numbered "Period 1 – Registration" is.
- **Breaks and lunch** are the gaps between periods. The booking list shows each gap as a
  line: "Lunch" when it's 25 minutes or longer, otherwise "Break" (including the 10-minute
  gap before Collab / PD on Wednesday and Thursday, when the first buses leave).
- **ICE notes** (Primary, Senior, Middle) aren't part of the period names.
- **Term 3's printed durations** don't always match its times: Period 5 (11:40–12:25) and
  Period 7 (13:35–14:20, printed "1:35 am") are 45 minutes, not the 40 written. The file
  uses the times as printed.
