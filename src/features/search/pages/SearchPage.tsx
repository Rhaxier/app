// Search as a screen of its own, for links to /search?q=… (the search button
// and ⌘K open the same search as an overlay instead: SearchOverlay). The
// query is kept in the address, so the back button and shared links work.
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { SearchPanel } from '../components/SearchPanel';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  return (
    <div className="stack">
      <PageHeader back={{ to: '/', label: 'Home' }} title="Search" />
      <SearchPanel
        initialQuery={params.get('q') ?? ''}
        onSearch={(query) => setParams(query ? { q: query } : {}, { replace: true })}
      />
    </div>
  );
}
