// The stairs and lift line icons as plain path data, so the same drawing is
// used by <Icon> (React) and by the map markers, which Leaflet needs as an
// HTML string. 24x24 viewBox, drawn with the icons' 1.8 stroke.
export const STAIRS_PATHS = ['M4 19.5h4.5v-4h4v-4h4v-4h3.5', 'M4 19.5V21', 'M20 7.5V4'];

export const LIFT_PATHS = [
  'M5.5 3.5h13a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z',
  'm9 9.5 3-3 3 3',
  'm9 14.5 3 3 3-3',
];

/** An SVG string for a Leaflet marker; it takes its colour from the CSS `color`. */
export function glyphSvg(paths: string[], size = 18): string {
  const body = paths.map((d) => `<path d="${d}"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
