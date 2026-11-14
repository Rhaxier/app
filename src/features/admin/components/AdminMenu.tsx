// The admin menu, grouped as in ../sections.ts. Every section has a grey
// subtitle under its title, like a category in iPhone Settings (the wording
// is in ../strings.ts). Two looks:
//   compact  the laptop side menu: small rows, the current section highlighted
//   full     the phone menu screen: big glass rows with an icon tile
import { NavLink } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { adminGroups } from '../sections';
import styles from './AdminMenu.module.css';

export function AdminMenu({ compact = false }: { compact?: boolean }) {
  return (
    <nav aria-label="Admin" className={compact ? styles.compact : styles.full}>
      {adminGroups.map((group) => (
        <section key={group.title} className={styles.group} aria-label={group.title}>
          <h2 className={`label ${styles.groupTitle}`}>{group.title}</h2>
          <ul className={styles.list}>
            {group.sections.map((section) => (
              <li key={section.path}>
                <NavLink to={`/admin/${section.path}`} className={`${styles.link} pressable`}>
                  <span className={styles.icon}>
                    <Icon name={section.icon} size={compact ? 18 : 20} />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.title}>{section.title}</span>
                    <span className={`meta ${styles.subtitle}`}>{section.description}</span>
                  </span>
                  {!compact && <Icon name="chevronRight" size={18} />}
                </NavLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
