// /map: the old map until the indoor map is live, then the indoor map.
//
// "Live" is app_settings.map_indoor_live, which rooms migration B turns on
// (MAP_NOTES.md). Reading it here, instead of building the app with a
// setting, means the release is one database step: open apps switch within
// a minute, and undoing the migration switches them back.
// VITE_INDOOR_MAP=true forces the indoor map, for trying it locally.
import { LoadingState } from '@/components/States';
import { useIndoorMapLive } from '../hooks';
import { IndoorMapPage } from './IndoorMapPage';
import { MapPage } from './MapPage';

export function MapSwitchPage() {
  const { live, ready } = useIndoorMapLive();
  if (!ready) return <LoadingState shape="block" />;
  return live ? <IndoorMapPage /> : <MapPage />;
}
