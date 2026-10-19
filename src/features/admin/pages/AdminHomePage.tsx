// Admin: the list of admin tools. Every change made on these screens is
// recorded in the audit log.
import { Link } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { SupwExportButton } from '../components/SupwExportButton';
import styles from './AdminHomePage.module.css';

const tools: { to: string; title: string; description: string; icon: IconName }[] = [
  {
    to: '/admin/users',
    title: 'Users and roles',
    description: 'Change roles, fix names and grades',
    icon: 'users',
  },
  {
    to: '/admin/responsibilities',
    title: 'Responsibilities',
    description: 'Facilities, IT, venues, SUPW',
    icon: 'shield',
  },
  {
    to: '/admin/staff-emails',
    title: 'Staff emails',
    description: 'Who becomes a teacher at sign-in',
    icon: 'mail',
  },
  {
    to: '/admin/venues',
    title: 'Venues',
    description: 'Bookable places and their rules',
    icon: 'calendar',
  },
  { to: '/admin/map', title: 'Map', description: 'Floors, rooms and pin positions', icon: 'map' },
  {
    to: '/admin/routes',
    title: 'Report routes',
    description: 'Which team gets each fix-it category',
    icon: 'flag',
  },
  {
    to: '/admin/settings',
    title: 'Settings',
    description: 'School name, sign-in, booking slots',
    icon: 'settings',
  },
  {
    to: '/admin/moderation',
    title: 'Moderation',
    description: 'Reported content and hidden posts',
    icon: 'eyeOff',
  },
  { to: '/admin/audit', title: 'Audit log', description: 'Who changed what', icon: 'layers' },
  {
    to: '/admin/outbox',
    title: 'Outbox',
    description: 'Emails and pushes waiting to be sent',
    icon: 'bell',
  },
];

export function AdminHomePage() {
  return (
    <div className="stack">
      <PageHeader
        back={{ to: '/approvals', label: 'Approvals' }}
        title="Admin"
        subtitle="Every change here is recorded in the audit log."
      />
      <ul className="stack-tight">
        {tools.map((tool) => (
          <li key={tool.to}>
            <Link to={tool.to} className={styles.tool}>
              <span className={styles.icon}>
                <Icon name={tool.icon} size={20} />
              </span>
              <span className={styles.text}>
                <span className={styles.title}>{tool.title}</span>
                <span className="meta">{tool.description}</span>
              </span>
              <Icon name="chevronRight" size={18} />
            </Link>
          </li>
        ))}
      </ul>
      <Card className="stack-tight">
        <h3>SUPW records</h3>
        <SupwExportButton />
      </Card>
    </div>
  );
}
