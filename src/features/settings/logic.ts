// Words for the feature switches, shared by the switch screen and the notes
// people see while a feature is off.
import type { FeatureName } from './api';

export const featureLabel: Record<FeatureName, string> = {
  announcements: 'Announcements',
  volunteering: 'Volunteering',
  projects: 'Projects',
  collab: 'Collab finder',
  venues: 'Venue booking',
  map: 'The campus map',
  fixit: 'Fix-it reports',
};

export const featureDescription: Record<FeatureName, string> = {
  announcements: 'The feed on Home and the Announcements screen',
  volunteering: 'SUPW events, sign-ups and hours (the Volunteer tab)',
  projects: 'Sharing projects with teachers',
  collab: 'Finding teammates (the Collab tab)',
  venues: 'Booking venues (the Book tab)',
  map: 'The floor plans (the Map tab)',
  fixit: 'Reporting problems around school',
};
