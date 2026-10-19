// One project in the list (reference screen 5): title, subject and who it's
// shared with, a status badge, and the latest teacher feedback inline.
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { projectStatus } from '@/lib/status';
import type { Project } from '../api';
import { sharingLine } from '../logic';
import styles from './ProjectCard.module.css';

interface ProjectCardProps {
  project: Project;
  /** Teachers see whose project it is. */
  showOwner: boolean;
  /** Owners get a "Share with a teacher" shortcut on unshared projects. */
  canShare: boolean;
}

export function ProjectCard({ project, showOwner, canShare }: ProjectCardProps) {
  const latest = project.feedback[0];
  return (
    <Card as="article" className={styles.card}>
      <div className={styles.top}>
        <div className={styles.titles}>
          <h3>
            <Link to={`/projects/${project.id}`} className={styles.link}>
              {project.title}
            </Link>
          </h3>
          <p className="meta">
            {showOwner && project.owner ? `${project.owner.full_name} · ` : ''}
            {sharingLine(project)}
          </p>
        </div>
        <StatusBadge map={projectStatus} status={project.status} />
      </div>

      {latest && (
        <div className={styles.feedback}>
          <Avatar
            name={latest.author?.full_name ?? 'Teacher'}
            initials={latest.author?.avatar_initials}
            size="small"
            tone="ink"
          />
          <p>{latest.body}</p>
        </div>
      )}

      {canShare && project.shares.length === 0 && (
        <ButtonLink to={`/projects/${project.id}?share=1`} variant="secondary" fullWidth>
          Share with a teacher
        </ButtonLink>
      )}
    </Card>
  );
}
