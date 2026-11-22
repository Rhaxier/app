// Inline SVG line icons (1.8px stroke, from the design PDF). Inline SVG means
// no icon font to load and the icon takes the text colour via currentColor.
// Icons are decorative (aria-hidden): the button or link around them carries
// the accessible name.

import { LIFT_PATHS, STAIRS_PATHS } from './connectorGlyphs';

const paths = {
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.2V20h5v-5.5h3V20h5V9.2" />
    </>
  ),
  map: (
    <>
      <path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
  heart: (
    <path d="M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M15.5 5.1a3.5 3.5 0 0 1 0 6.8M17.6 14.4a6.2 6.2 0 0 1 3.6 5.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  approvals: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2.5" />
      <path d="M9 3.5h6v2.5H9zM9 13.2l2.2 2.2 4-4.2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  // The system Share symbol (a box with an arrow up), for "tap Share".
  share: (
    <>
      <path d="M12 3.5v11" />
      <path d="m8 7.5 4-4 4 4" />
      <path d="M8.5 10.5h-2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
    </>
  ),
  folder: (
    <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
  ),
  camera: (
    <>
      <path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.5" />
      <path d="m20.5 16-5-5-9 8.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevronLeft: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  arrowRight: <path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5" />,
  // "Report" on Home: a screwdriver, as on the Home mockup.
  wrench: (
    <>
      <path d="m14.5 9.5-8.8 8.8a1.6 1.6 0 0 1-2.3-2.3l8.8-8.8" />
      <path d="m12.2 7.2 2.6-2.6 4.6 4.6-2.6 2.6z" />
      <path d="m17.1 6.9 2.4-2.4" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <path d="M12 4 2.8 19.5h18.4z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m3.8 7.2 8.2 6 8.2-6" />
    </>
  ),
  flag: <path d="M5.5 21V4h11l-2.2 4 2.2 4h-11" />,
  settings: (
    <>
      <path d="M4 7h9.5M18.5 7H20M4 17h3.5M12.5 17H20" />
      <circle cx="16" cy="7" r="2.5" />
      <circle cx="10" cy="17" r="2.5" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5" />
      <path d="M10 16.5 5.5 12 10 7.5M5.5 12H16" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 11v5M13.5 11v5" />,
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3.5 3.5l17 17" />
      <path d="M10.6 5.6A9 9 0 0 1 12 5.5c4.8 0 8 4.2 9 6.5a12.6 12.6 0 0 1-2.6 3.6M6.7 6.9C4.8 8.1 3.6 10 3 12c1 2.3 4.2 6.5 9 6.5a9 9 0 0 0 4.3-1.1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  paperclip: (
    <path d="m19.5 11.5-7.6 7.6a4.8 4.8 0 0 1-6.8-6.8l8-8a3.2 3.2 0 0 1 4.5 4.5l-8 8a1.6 1.6 0 0 1-2.3-2.3l7.3-7.3" />
  ),
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  megaphone: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l8.5 4.5v-15L7 9H5a1 1 0 0 0-1 1z" />
      <path d="M18.5 9a4 4 0 0 1 0 6" />
    </>
  ),
  shield: <path d="M12 3.5 5 6.2v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6.2z" />,
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5l8.5 4.5 8.5-4.5" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  ),
  // Fix-it categories (report_categories.icon names one of these).
  bolt: <path d="M13 3.5 5.5 13.5h6l-1 7 7.5-10h-6z" />,
  wind: (
    <path d="M3.5 9h11a2.75 2.75 0 1 0-2.75-2.75M3.5 13h15a2.75 2.75 0 1 1-2.75 2.75M3.5 17h7" />
  ),
  droplet: <path d="M12 3.5s-6 6.6-6 10.8a6 6 0 0 0 12 0C18 10.1 12 3.5 12 3.5z" />,
  box: (
    <>
      <path d="m12 3.5 8 4v9l-8 4-8-4v-9z" />
      <path d="m4 7.5 8 4 8-4M12 11.5v9" />
    </>
  ),
  monitor: (
    <>
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="2" />
      <path d="M8.5 20h7M12 16v4" />
    </>
  ),
  swap: (
    <>
      <path d="M7.5 19.5V4.5" />
      <path d="m4 8 3.5-3.5L11 8" />
      <path d="M16.5 4.5v15" />
      <path d="m13 16 3.5 3.5L20 16" />
    </>
  ),
  // Shared with the map's stairs and lift markers (connectorGlyphs.ts).
  stairs: (
    <>
      {STAIRS_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </>
  ),
  lift: (
    <>
      {LIFT_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </>
  ),
} as const;

/** Every icon name, e.g. for the admin's icon picker. */
export const ICON_NAMES = Object.keys(paths) as IconName[];

export type IconName = keyof typeof paths;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 22, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
