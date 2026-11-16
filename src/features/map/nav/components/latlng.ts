// Map coordinates <-> Leaflet positions. The geometry's y grows downward (like
// an image), Leaflet's latitude grows upward, so a point (x, y) is drawn at
// [lat = -y, lng = x]. Every floor uses the same system.
import type L from 'leaflet';
import type { Point } from '../types.ts';

export const toLatLng = (point: Point): L.LatLngTuple => [-point.y, point.x];

export const fromLatLng = (latlng: L.LatLng): Point => ({ x: latlng.lng, y: -latlng.lat });
