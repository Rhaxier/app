// Fits a full-screen floor plan again when the controls over it move.
// Shared by both maps: the indoor map's FloorPlanView and the old MapView.
import type L from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { fitPadding, type MapMargins } from '../mapMargins';

/**
 * Fits the plan again when its margins change: an iPad turned between upright
 * and sideways moves the controls from the top and bottom to a column at the
 * side, or the other way. The first fit is MapContainer's own.
 */
export function RefitOnMargins({
  bounds,
  margins,
}: {
  bounds: L.LatLngBoundsExpression;
  margins: MapMargins;
}) {
  const map = useMap();
  const key = `${margins.top}:${margins.bottom}:${margins.left}:${margins.right}`;
  const shown = useRef(key);
  useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    map.fitBounds(bounds, { ...fitPadding(margins), animate: false });
    // The key stands for the margins; the plan's bounds don't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
