// The report's photo, through a short-lived signed link (private bucket).
import { usePhotoUrl } from '../hooks';
import styles from './ReportPhoto.module.css';

export function ReportPhoto({ path, alt }: { path: string; alt: string }) {
  const url = usePhotoUrl(path);
  if (url.isError) return <p className="meta">The photo couldn't be loaded.</p>;
  if (!url.data) return <div className={styles.placeholder} aria-hidden="true" />;
  return (
    <a href={url.data} target="_blank" rel="noopener noreferrer">
      <img className={styles.photo} src={url.data} alt={alt} />
    </a>
  );
}
