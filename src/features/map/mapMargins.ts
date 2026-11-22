// Where a full-screen map fits its plan (and routes): clear of the controls
// that float over it, in screen px. Each map screen gives its phone margins;
// marginsFor() turns them into the margins for the arrangement on screen.
//
// Three arrangements of the same controls (MapPage.module.css):
//   phone   search and layers along the top, the card (directions, a report)
//           at the bottom above the tab bar
//   tablet  the same, beside the side navigation, with no tab bar below: an
//           iPad held upright, where a column at the side would leave the
//           plan only a narrow strip
//   side    a wide screen held sideways (a laptop, an iPad turned): one
//           column at the left with the controls and the card, and the plan
//           fits to the right of it
// The map screens always have the icon rail (AppLayout), never the sidebar
// with labels, so the plan gets the width.
import type L from 'leaflet';
import { LAPTOP_QUERY, NAV_SPACE, useWideLayout } from '@/lib/layout';
import { useMediaQuery } from '@/lib/useMediaQuery';

export interface MapMargins {
  top: number;
  bottom: number;
  /** Defaults to a small edge margin (16px) when not given. */
  left?: number;
  right?: number;
}

export type MapArrangement = 'phone' | 'tablet' | 'side';

/** When the controls form a column at the side (the same query is in MapPage.module.css). */
export const SIDE_PANEL_QUERY = `${LAPTOP_QUERY} and (orientation: landscape)`;

/** The controls' column in the side arrangement (--map-panel in MapPage.module.css). */
export const MAP_PANEL_WIDTH = 380;

/** The tab bar's room at the bottom of a phone (--tabbar-space without the safe area). */
const TAB_BAR_SPACE = 62 + 18;
/** --chrome-inset: floating controls sit 16px in from the edges. */
const INSET = 16;

export function useMapArrangement(): MapArrangement {
  const wide = useWideLayout();
  const side = useMediaQuery(SIDE_PANEL_QUERY);
  if (side) return 'side';
  return wide ? 'tablet' : 'phone';
}

/** The margins for this arrangement, given the screen's phone margins. */
export function marginsFor(arrangement: MapArrangement, phone: MapMargins): MapMargins {
  const nav = NAV_SPACE.tablet; // the icon rail
  if (arrangement === 'side') {
    return { top: 24, bottom: 24, left: nav + INSET + MAP_PANEL_WIDTH + 24, right: 24 };
  }
  if (arrangement === 'tablet') {
    return { ...phone, bottom: phone.bottom - TAB_BAR_SPACE, left: nav + INSET, right: INSET };
  }
  return phone;
}

/** Leaflet's fit padding for a full-screen plan (16px at the sides unless given). */
export function fitPadding(margins: MapMargins): L.FitBoundsOptions {
  return {
    paddingTopLeft: [margins.left ?? 16, margins.top],
    paddingBottomRight: [margins.right ?? 16, margins.bottom],
  };
}
