// The admin dashboard's screens, all under /admin and all admins-only (the
// router wraps them in RequireRole). Each one loads on first visit. The menu
// that links to them is ./sections.ts: add new sections in both places.
import type { RouteObject } from 'react-router-dom';
import { lazyPage } from '@/app/lazyPage';

export const adminRoutes: RouteObject = {
  path: '/admin',
  lazy: lazyPage(() => import('./components/AdminLayout'), 'AdminLayout'),
  children: [
    { index: true, lazy: lazyPage(() => import('./pages/AdminIndexPage'), 'AdminIndexPage') },
    { path: 'overview', lazy: lazyPage(() => import('./pages/OverviewPage'), 'OverviewPage') },
    // People
    { path: 'users', lazy: lazyPage(() => import('./pages/UsersPage'), 'UsersPage') },
    { path: 'grades', lazy: lazyPage(() => import('./pages/GradesPage'), 'GradesPage') },
    { path: 'classes', lazy: lazyPage(() => import('./pages/ClassesPage'), 'ClassesPage') },
    { path: 'import', lazy: lazyPage(() => import('./pages/ImportPage'), 'ImportPage') },
    { path: 'rollover', lazy: lazyPage(() => import('./pages/RolloverPage'), 'RolloverPage') },
    {
      path: 'staff-emails',
      lazy: lazyPage(() => import('./pages/StaffEmailsPage'), 'StaffEmailsPage'),
    },
    {
      path: 'responsibilities',
      lazy: lazyPage(() => import('./pages/ResponsibilitiesPage'), 'ResponsibilitiesPage'),
    },
    // Features
    { path: 'venues', lazy: lazyPage(() => import('./pages/VenuesAdminPage'), 'VenuesAdminPage') },
    { path: 'map', lazy: lazyPage(() => import('./pages/MapAdminPage'), 'MapAdminPage') },
    {
      path: 'reports',
      lazy: lazyPage(() => import('./pages/ReportsQueuePage'), 'ReportsQueuePage'),
    },
    { path: 'routes', lazy: lazyPage(() => import('./pages/RoutesPage'), 'RoutesPage') },
    // Moderation
    {
      path: 'moderation',
      lazy: lazyPage(() => import('./pages/ModerationPage'), 'ModerationPage'),
    },
    // Notifications
    { path: 'outbox', lazy: lazyPage(() => import('./pages/OutboxPage'), 'OutboxPage') },
    // System
    { path: 'settings', lazy: lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage') },
    { path: 'audit', lazy: lazyPage(() => import('./pages/AuditLogPage'), 'AuditLogPage') },
  ],
};
