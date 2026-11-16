// Admin > Map and rooms: the indoor map's room names (per term) and its
// stairs and lifts. Walls, rooms and corridors come from the traced floor
// plan (geometry.json) and are never edited here.
//
// The tab is kept in the address (?tab=connectors) so a link from a
// validation message can open the right one. Both tabs share one router
// (NavRouterProvider), which is also what keeps them up to date live.
import { useSearchParams } from 'react-router-dom';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ClassroomsTab } from '../components/map-rooms/ClassroomsTab';
import { ConnectorStatus } from '../components/map-rooms/ConnectorStatus';
import { NavRouterProvider } from '@/features/map/nav/RouterProvider';
import { AdminPage } from '../components/AdminPage';
import { pageIntros } from '../strings';

type Tab = 'classrooms' | 'connectors';

export function MapRoomsPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'connectors' ? 'connectors' : 'classrooms';

  return (
    <AdminPage title="Map and rooms" description={pageIntros['map-rooms']} fullWidth>
      <SegmentedControl<Tab>
        label="Part"
        value={tab}
        onChange={(next) =>
          setParams(next === 'classrooms' ? {} : { tab: next }, { replace: true })
        }
        options={[
          { value: 'classrooms', label: 'Classrooms' },
          { value: 'connectors', label: 'Stairs and lifts' },
        ]}
      />
      <NavRouterProvider>
        {tab === 'classrooms' ? <ClassroomsTab /> : <ConnectorStatus />}
      </NavRouterProvider>
    </AdminPage>
  );
}
