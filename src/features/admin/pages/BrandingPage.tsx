// Admin > System > Branding (Q9). The school's name, logo and accent colour.
// The app reads them at start-up (public_status) and sets the accent for both
// themes (src/app/Branding.tsx). White text sits on the accent, so it must
// reach 4.5:1 contrast: the colour is checked as you type (src/lib/contrast.ts)
// and again by the database. The database's default colour means "use the
// design's system blue".
import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError, TextField } from '@/components/Input';
import { LoadingState } from '@/components/States';
import { DEFAULT_ACCENT } from '@/app/Branding';
import type { AppSettings } from '@/features/settings/api';
import { useAppSettings } from '@/features/settings/hooks';
import { accentProblem, brandAccents, contrastRatio } from '@/lib/contrast';
import { errorMessage } from '@/lib/errors';
import { AdminPage } from '../components/AdminPage';
import { useUpdateSettings, useUploadLogo } from '../hooks';
import styles from './BrandingPage.module.css';

export function BrandingPage() {
  const settings = useAppSettings();
  return (
    <AdminPage title="Branding" description="The school's name, logo and colour.">
      {settings.isPending && <LoadingState />}
      {settings.data && <BrandingForm key={settings.data.updated_at} settings={settings.data} />}
    </AdminPage>
  );
}

function BrandingForm({ settings }: { settings: AppSettings }) {
  const save = useUpdateSettings();
  const upload = useUploadLogo();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(settings.school_name);
  const [logoUrl, setLogoUrl] = useState(settings.logo_url ?? '');
  const [accent, setAccent] = useState(settings.accent_color);
  const problem = accentProblem(accent);
  const valid = !problem && name.trim() !== '';
  const designBlue = accent.toLowerCase() === DEFAULT_ACCENT || problem !== null;
  const brand = designBlue ? null : brandAccents(accent);
  // The design's own blue and its tints (tokens.css) when there's no school colour.
  const preview = {
    light: { acc: brand?.light ?? '#007aff', soft: brand?.lightSoft ?? 'rgba(0, 122, 255, 0.11)' },
    dark: { acc: brand?.dark ?? '#0a84ff', soft: brand?.darkSoft ?? 'rgba(10, 132, 255, 0.18)' },
  };

  return (
    <>
      <Card className="stack-tight">
        <TextField
          label="School name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={name.trim() ? undefined : 'Enter the school name.'}
        />
      </Card>

      <Card className="stack-tight">
        <h2 className={styles.heading}>Logo</h2>
        <div className={styles.logoRow}>
          {logoUrl ? (
            <img className={styles.logo} src={logoUrl} alt="The current logo" />
          ) : (
            <span className="meta">No logo yet: a plain icon is shown.</span>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="visually-hidden"
          aria-label="Logo image"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file, { onSuccess: setLogoUrl });
          }}
        />
        <div className="row-wrap">
          <Button
            variant="secondary"
            icon="image"
            loading={upload.isPending}
            onClick={() => fileInput.current?.click()}
          >
            Upload a logo
          </Button>
          {logoUrl && (
            <Button variant="ghost" onClick={() => setLogoUrl('')}>
              Remove
            </Button>
          )}
        </div>
        <p className="meta">PNG, JPEG, WebP or SVG, up to 1 MB. A square image works best.</p>
      </Card>

      <Card className="stack-tight">
        <h2 className={styles.heading}>Accent colour</h2>
        <div className={styles.colourRow}>
          <input
            type="color"
            className={styles.picker}
            aria-label="Pick a colour"
            value={/^#[0-9a-f]{6}$/i.test(accent) ? accent : DEFAULT_ACCENT}
            onChange={(e) => setAccent(e.target.value)}
          />
          <TextField
            label="Colour (hex)"
            value={accent}
            maxLength={7}
            onChange={(e) => setAccent(e.target.value.trim())}
            error={problem ?? undefined}
          />
        </div>
        {!problem && (
          <p className="meta" aria-live="polite">
            White text on it: {contrastRatio(accent, '#ffffff').toFixed(1)}:1 (needs 4.5:1).
          </p>
        )}
        {/* A preview of the colour in each theme. Dark mode uses a lighter mix
            of it, so accent text still reads on a dark card. */}
        <div className={styles.previews} aria-hidden="true">
          {(['light', 'dark'] as const).map((theme) => (
            <div key={theme} className={`${styles.preview} ${styles[theme]}`}>
              <span className={styles.previewButton} style={{ background: preview[theme].acc }}>
                Request
              </span>
              <span
                className={styles.previewBadge}
                style={{ background: preview[theme].soft, color: preview[theme].acc }}
              >
                You're in
              </span>
            </div>
          ))}
        </div>
        {designBlue && (
          <p className="meta">This is the default, so the app uses the design's system blue.</p>
        )}
        <Button variant="ghost" onClick={() => setAccent(DEFAULT_ACCENT)}>
          Back to the design's blue
        </Button>
      </Card>

      <FormError message={save.isError ? errorMessage(save.error) : null} />
      <Button
        fullWidth
        disabled={!valid}
        loading={save.isPending}
        onClick={() =>
          save.mutate({
            school_name: name.trim(),
            logo_url: logoUrl || null,
            accent_color: accent.toLowerCase(),
          })
        }
      >
        Save branding
      </Button>
    </>
  );
}
