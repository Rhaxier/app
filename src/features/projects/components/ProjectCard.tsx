// One project in the list (reference screen 5; design PDF page 8, "Work that
// gets seen"): title, subject and who it's shared with, one status tag at the
// edge, and the teacher's latest feedback quoted inline, so nobody goes
// looking. It's a row: the Projects screen groups the rows in one card.
import { Link } from 'react-router-dom';
import { ButtonLink } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { relativeTime } from '@/lib/dates';
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
    <article className={`${styles.row} pressable-card`}>
      <div className={styles.top}>
        <div className={styles.titles}>
          <h3 className={styles.title}>
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
        <figure className={styles.feedback}>
          <blockquote className={styles.quote}>
            <p>{latest.body}</p>
          </blockquote>
          <figcaption className="meta">
            — {latest.author?.full_name ?? 'Teacher'} · {relativeTime(latest.created_at)}
          </figcaption>
        </figure>
      )}

      {canShare && project.shares.length === 0 && (
        <ButtonLink
          to={`/projects/${project.id}?share=1`}
          variant="secondary"
          fullWidth
          className={styles.share}
        >
          Share with a teacher
        </ButtonLink>
      )}
    </article>
  );
}
