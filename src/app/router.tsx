// Every screen and its address. One route per screen; staff-only and
// admin-only screens sit inside RequireRole.
//
// Most screens are loaded "lazily": their code is downloaded the first time
// someone opens them, so the app starts faster on a phone. (The map library
// and the admin screens, for example, are only needed by some people.)
// Home, sign-in, Me and the inbox are needed straight away, so they're not.
import { createBrowserRouter } from 'react-router-dom';
import { LoadingState } from '@/components/States';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ProfilePage } from '@/features/auth/pages/ProfilePage';
import { HomePage } from '@/features/home/pages/HomePage';
import { InboxPage } from '@/features/notifications/pages/InboxPage';
import { NotificationSettingsPage } from '@/features/notifications/pages/NotificationSettingsPage';
import { adminRoutes } from '@/features/admin/routes';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequireFeature, RequireRole } from './guards';
import { lazyPage } from './lazyPage';
import { NotFoundPage } from './NotFoundPage';
import { RootLayout } from './RootLayout';

const announcements = () => import('@/features/announcements/pages/AnnouncementsPage');
const announcement = () => import('@/features/announcements/pages/AnnouncementDetailPage');
const announcementForm = () => import('@/features/announcements/pages/AnnouncementFormPage');
const volunteer = () => import('@/features/volunteering/pages/VolunteerPage');
const event = () => import('@/features/volunteering/pages/EventDetailPage');
const eventForm = () => import('@/features/volunteering/pages/EventFormPage');
const projects = () => import('@/features/projects/pages/ProjectsPage');
const project = () => import('@/features/projects/pages/ProjectDetailPage');
const projectForm = () => import('@/features/projects/pages/ProjectFormPage');
const collab = () => import('@/features/collab/pages/CollabPage');
const collabPost = () => import('@/features/collab/pages/CollabDetailPage');
const collabForm = () => import('@/features/collab/pages/CollabFormPage');
const mapSwitch = () => import('@/features/map/pages/MapSwitchPage');
const indoorMap = () => import('@/features/map/pages/IndoorMapPage');
const reportForm = () => import('@/features/fixit/pages/ReportFormPage');
const report = () => import('@/features/fixit/pages/ReportDetailPage');
const book = () => import('@/features/venues/pages/BookPage');
const bookingRequest = () => import('@/features/venues/pages/BookingRequestPage');
const myBookings = () => import('@/features/venues/pages/MyBookingsPage');
const search = () => import('@/features/search/pages/SearchPage');
const bellTimes = () => import('@/features/school/pages/BellTimesPage');
const approvals = () => import('@/features/approvals/pages/ApprovalsPage');

export const router = createBrowserRouter(
  [
    {
      element: <RootLayout />,
      // Shown while the first screen's code loads.
      hydrateFallbackElement: <LoadingState />,
      children: [
        { path: '/login', element: <LoginPage /> },
        {
          element: <RequireAuth />,
          children: [
            {
              element: <AppLayout />,
              children: [
                { path: '/', element: <HomePage /> },
                { path: '/me', element: <ProfilePage /> },
                { path: '/notifications', element: <InboxPage /> },
                { path: '/notifications/settings', element: <NotificationSettingsPage /> },
                { path: '/search', lazy: lazyPage(search, 'SearchPage') },
                { path: '/bell-times', lazy: lazyPage(bellTimes, 'BellTimesPage') },
                // Each feature's screens sit inside RequireFeature: while an admin
                // has switched the feature off, everyone else gets a short note.
                {
                  element: <RequireFeature feature="volunteering" />,
                  children: [
                    { path: '/volunteer', lazy: lazyPage(volunteer, 'VolunteerPage') },
                    { path: '/volunteer/new', lazy: lazyPage(eventForm, 'NewEventPage') },
                    { path: '/volunteer/:id', lazy: lazyPage(event, 'EventDetailPage') },
                    { path: '/volunteer/:id/edit', lazy: lazyPage(eventForm, 'EditEventPage') },
                  ],
                },
                {
                  element: <RequireFeature feature="projects" />,
                  children: [
                    { path: '/projects', lazy: lazyPage(projects, 'ProjectsPage') },
                    { path: '/projects/new', lazy: lazyPage(projectForm, 'NewProjectPage') },
                    { path: '/projects/:id', lazy: lazyPage(project, 'ProjectDetailPage') },
                    { path: '/projects/:id/edit', lazy: lazyPage(projectForm, 'EditProjectPage') },
                  ],
                },
                {
                  element: <RequireFeature feature="collab" />,
                  children: [
                    { path: '/collab', lazy: lazyPage(collab, 'CollabPage') },
                    { path: '/collab/new', lazy: lazyPage(collabForm, 'NewCollabPage') },
                    { path: '/collab/:id', lazy: lazyPage(collabPost, 'CollabDetailPage') },
                    { path: '/collab/:id/edit', lazy: lazyPage(collabForm, 'EditCollabPage') },
                  ],
                },
                {
                  element: <RequireFeature feature="map" />,
                  children: [
                    {
                      path: '/map',
                      // The old map until the indoor map is live (rooms migration B).
                      lazy: lazyPage(mapSwitch, 'MapSwitchPage'),
                    },
                    {
                      // Staff try the indoor map here before it becomes /map.
                      element: <RequireRole role="staff" />,
                      children: [
                        { path: '/map/indoor', lazy: lazyPage(indoorMap, 'IndoorMapPage') },
                      ],
                    },
                  ],
                },
                {
                  element: <RequireFeature feature="fixit" />,
                  children: [
                    { path: '/map/report', lazy: lazyPage(reportForm, 'ReportFormPage') },
                    { path: '/reports/:id', lazy: lazyPage(report, 'ReportDetailPage') },
                  ],
                },
                {
                  element: <RequireFeature feature="venues" />,
                  children: [
                    { path: '/book', lazy: lazyPage(book, 'BookPage') },
                    { path: '/book/request', lazy: lazyPage(bookingRequest, 'BookingRequestPage') },
                    { path: '/book/mine', lazy: lazyPage(myBookings, 'MyBookingsPage') },
                  ],
                },
                {
                  element: <RequireFeature feature="announcements" />,
                  children: [
                    { path: '/announcements', lazy: lazyPage(announcements, 'AnnouncementsPage') },
                    {
                      path: '/announcements/:id',
                      lazy: lazyPage(announcement, 'AnnouncementDetailPage'),
                    },
                    {
                      element: <RequireRole role="staff" />,
                      children: [
                        {
                          path: '/announcements/new',
                          lazy: lazyPage(announcementForm, 'NewAnnouncementPage'),
                        },
                        {
                          path: '/announcements/:id/edit',
                          lazy: lazyPage(announcementForm, 'EditAnnouncementPage'),
                        },
                      ],
                    },
                  ],
                },
                {
                  element: <RequireRole role="staff" />,
                  children: [{ path: '/approvals', lazy: lazyPage(approvals, 'ApprovalsPage') }],
                },
                {
                  element: <RequireRole role="admin" />,
                  children: [adminRoutes],
                },
                { path: '*', element: <NotFoundPage /> },
              ],
            },
          ],
        },
      ],
    },
  ],
  // On GitHub Pages the app lives under /<repo>/; elsewhere BASE_URL is '/'.
  { basename: import.meta.env.BASE_URL },
);
