// Every screen and its address. One route per screen; staff-only and
// admin-only screens sit inside RequireRole.
import { createBrowserRouter } from 'react-router-dom';
import { AdminHomePage } from '@/features/admin/pages/AdminHomePage';
import { AuditLogPage } from '@/features/admin/pages/AuditLogPage';
import { MapAdminPage } from '@/features/admin/pages/MapAdminPage';
import { ModerationPage } from '@/features/admin/pages/ModerationPage';
import { OutboxPage } from '@/features/admin/pages/OutboxPage';
import { ResponsibilitiesPage } from '@/features/admin/pages/ResponsibilitiesPage';
import { RoutesPage } from '@/features/admin/pages/RoutesPage';
import { SettingsPage } from '@/features/admin/pages/SettingsPage';
import { StaffEmailsPage } from '@/features/admin/pages/StaffEmailsPage';
import { UsersPage } from '@/features/admin/pages/UsersPage';
import { VenuesAdminPage } from '@/features/admin/pages/VenuesAdminPage';
import { ApprovalsPage } from '@/features/approvals/pages/ApprovalsPage';
import { AnnouncementDetailPage } from '@/features/announcements/pages/AnnouncementDetailPage';
import {
  EditAnnouncementPage,
  NewAnnouncementPage,
} from '@/features/announcements/pages/AnnouncementFormPage';
import { AnnouncementsPage } from '@/features/announcements/pages/AnnouncementsPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ProfilePage } from '@/features/auth/pages/ProfilePage';
import { HomePage } from '@/features/home/pages/HomePage';
import { InboxPage } from '@/features/notifications/pages/InboxPage';
import { NotificationSettingsPage } from '@/features/notifications/pages/NotificationSettingsPage';
import { EventDetailPage } from '@/features/volunteering/pages/EventDetailPage';
import { EditEventPage, NewEventPage } from '@/features/volunteering/pages/EventFormPage';
import { VolunteerPage } from '@/features/volunteering/pages/VolunteerPage';
import { ProjectDetailPage } from '@/features/projects/pages/ProjectDetailPage';
import { EditProjectPage, NewProjectPage } from '@/features/projects/pages/ProjectFormPage';
import { ProjectsPage } from '@/features/projects/pages/ProjectsPage';
import { CollabDetailPage } from '@/features/collab/pages/CollabDetailPage';
import { EditCollabPage, NewCollabPage } from '@/features/collab/pages/CollabFormPage';
import { CollabPage } from '@/features/collab/pages/CollabPage';
import { BookingRequestPage } from '@/features/venues/pages/BookingRequestPage';
import { BookPage } from '@/features/venues/pages/BookPage';
import { MyBookingsPage } from '@/features/venues/pages/MyBookingsPage';
import { ReportDetailPage } from '@/features/fixit/pages/ReportDetailPage';
import { ReportFormPage } from '@/features/fixit/pages/ReportFormPage';
import { MapPage } from '@/features/map/pages/MapPage';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequireRole } from './guards';
import { NotFoundPage } from './NotFoundPage';
import { RootLayout } from './RootLayout';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
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
              { path: '/volunteer', element: <VolunteerPage /> },
              { path: '/volunteer/new', element: <NewEventPage /> },
              { path: '/volunteer/:id', element: <EventDetailPage /> },
              { path: '/volunteer/:id/edit', element: <EditEventPage /> },
              { path: '/projects', element: <ProjectsPage /> },
              { path: '/projects/new', element: <NewProjectPage /> },
              { path: '/projects/:id', element: <ProjectDetailPage /> },
              { path: '/projects/:id/edit', element: <EditProjectPage /> },
              { path: '/collab', element: <CollabPage /> },
              { path: '/collab/new', element: <NewCollabPage /> },
              { path: '/collab/:id', element: <CollabDetailPage /> },
              { path: '/collab/:id/edit', element: <EditCollabPage /> },
              { path: '/map', element: <MapPage /> },
              { path: '/map/report', element: <ReportFormPage /> },
              { path: '/reports/:id', element: <ReportDetailPage /> },
              { path: '/book', element: <BookPage /> },
              { path: '/book/request', element: <BookingRequestPage /> },
              { path: '/book/mine', element: <MyBookingsPage /> },
              { path: '/announcements', element: <AnnouncementsPage /> },
              { path: '/announcements/:id', element: <AnnouncementDetailPage /> },
              {
                element: <RequireRole role="staff" />,
                children: [
                  { path: '/announcements/new', element: <NewAnnouncementPage /> },
                  { path: '/announcements/:id/edit', element: <EditAnnouncementPage /> },
                  { path: '/approvals', element: <ApprovalsPage /> },
                ],
              },
              {
                element: <RequireRole role="admin" />,
                children: [
                  { path: '/admin', element: <AdminHomePage /> },
                  { path: '/admin/users', element: <UsersPage /> },
                  { path: '/admin/responsibilities', element: <ResponsibilitiesPage /> },
                  { path: '/admin/staff-emails', element: <StaffEmailsPage /> },
                  { path: '/admin/venues', element: <VenuesAdminPage /> },
                  { path: '/admin/map', element: <MapAdminPage /> },
                  { path: '/admin/routes', element: <RoutesPage /> },
                  { path: '/admin/settings', element: <SettingsPage /> },
                  { path: '/admin/moderation', element: <ModerationPage /> },
                  { path: '/admin/audit', element: <AuditLogPage /> },
                  { path: '/admin/outbox', element: <OutboxPage /> },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
