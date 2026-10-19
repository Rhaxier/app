// Every screen and its address. One route per screen; staff-only and
// admin-only screens sit inside RequireRole.
import { createBrowserRouter } from 'react-router-dom';
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
              { path: '/announcements', element: <AnnouncementsPage /> },
              { path: '/announcements/:id', element: <AnnouncementDetailPage /> },
              {
                element: <RequireRole role="staff" />,
                children: [
                  { path: '/announcements/new', element: <NewAnnouncementPage /> },
                  { path: '/announcements/:id/edit', element: <EditAnnouncementPage /> },
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
