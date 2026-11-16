import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { LayoutGrid, List, Newspaper } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { javNewsOptions } from '../../api/queries';
import type { JavNewsCategory } from '../../api/types';
import { InfiniteGrid } from '../../components/jav/grid';
import { NewsCard } from '../../components/jav/NewsCard';
import { SearchBox } from '../../components/jav/SearchBox';
import { Segmented } from '../../components/manga/Segmented';
import { PageHeader, Skeleton } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';
import { formatDate, NEWS_CATEGORIES, newsRoute } from '../../lib/jav';

type Category = JavNewsCategory | 'all';
export type NewsLayout = 'magazine' | 'grid' | 'list';

const LAYOUTS: { value: NewsLayout; label: string; icon: LucideIcon }[] = [
  { value: 'magazine', label: 'Magazine', icon: Newspaper },
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'list', label: 'List', icon: List },
];

/**
 * Magazine: the newest post large across two columns and two rows, with the next ones stacked
 * beside it and the rest in a grid (dense flow fills every gap, top to bottom). Grid: even cards
 * across the full width. List: one post per row.
 */
const GRID_CLASS: Record<NewsLayout, string> = {
  magazine: 'grid grid-flow-row-dense gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
  grid: 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
  list: 'grid gap-4',
};

const LAYOUT_KEY = 'echo:jav:newsLayout';

function savedLayout(): NewsLayout {
  try {
    const value = localStorage.getItem(LAYOUT_KEY);
    return value === 'grid' || value === 'list' ? value : 'magazine';
  } catch {
    return 'magazine';
  }
}

function saveLayout(layout: NewsLayout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Private windows can refuse storage; the layout still applies until the page closes.
  }
}

/** The site's news: weekly top movies and idol debuts, idol and site updates, newest first. */
export function JavNewsPage() {
  useCrumbs([{ label: 'JAV' }, { label: 'News' }]);
  const [params, setParams] = useSearchParams();
  const raw = params.get('category');
  const category: Category = NEWS_CATEGORIES.some((c) => c.value === raw) ? (raw as Category) : 'all';
  const [layout, setLayout] = useState<NewsLayout>(savedLayout);
  const list = useInfiniteQuery(javNewsOptions(category === 'all' ? null : category));
  const all = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  // The site can't search its posts, so the box searches the posts loaded so far.
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const items = useMemo(
    () => (needle ? all.filter((i) => `${i.title} ${i.summary}`.toLowerCase().includes(needle)) : all),
    [all, needle],
  );
  const suggestions = useMemo(
    () => all.map((i) => ({ key: i.path, label: i.title, sub: formatDate(i.date), image: i.image, to: newsRoute(i.path) })),
    [all],
  );

  const chooseLayout = (next: NewsLayout) => {
    setLayout(next);
    saveLayout(next);
  };

  return (
    <>
      <PageHeader
        title="News"
        meta="Weekly charts, new debuts and updates from javdatabase.com."
        actions={<LayoutPicker value={layout} onChange={chooseLayout} />}
      />
      <div className="mb-5 max-w-xl">
        <SearchBox
          scope="news"
          source={{ type: 'local', items: suggestions }}
          placeholder="Search news"
          onSubmit={setFilter}
          onTextChange={setFilter}
          size="md"
        />
      </div>
      <div className="mb-8">
        <Segmented<Category>
          label="Category"
          value={category}
          onChange={(v) => setParams(v === 'all' ? {} : { category: v }, { replace: true })}
          options={NEWS_CATEGORIES}
        />
      </div>
      {needle && (
        <p className="mb-5 text-sm text-muted-foreground">
          {items.length} of the {all.length} posts loaded so far match “{filter.trim()}”.
          {list.hasNextPage && ' Scroll down to search older posts too.'}
        </p>
      )}
      <InfiniteGrid
        key={category}
        list={list}
        items={items}
        itemKey={(i) => i.path}
        render={(item, i) => (
          <NewsCard item={item} variant={layout === 'list' ? 'row' : layout === 'magazine' && i === 0 ? 'feature' : 'tile'} />
        )}
        itemClassName={(_, i) => (layout === 'magazine' && i === 0 ? 'md:col-span-2 lg:row-span-2' : '')}
        className={GRID_CLASS[layout]}
        skeleton={<NewsSkeletons layout={layout} />}
        emptyText={needle ? 'No loaded posts match this search.' : 'No posts in this category.'}
      />
    </>
  );
}

/** Three icon buttons that pick how the posts are laid out. */
function LayoutPicker({ value, onChange }: { value: NewsLayout; onChange: (layout: NewsLayout) => void }) {
  return (
    <div role="radiogroup" aria-label="Layout" className="flex rounded-lg border border-white/10 bg-white/[0.06] p-1">
      {LAYOUTS.map(({ value: v, label, icon: Icon }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => onChange(v)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors ${on ? 'bg-white text-black' : 'text-foreground/70 hover:bg-white/10 hover:text-foreground'}`}
          >
            <Icon size={16} aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function NewsSkeletons({ layout }: { layout: NewsLayout }) {
  const cell = (i: number): ReactNode => {
    if (layout === 'list') return <Skeleton key={i} className="h-40 w-full rounded-2xl" />;
    const lead = layout === 'magazine' && i === 0;
    return <Skeleton key={i} className={`${lead ? 'min-h-[18rem] md:col-span-2 lg:row-span-2' : 'h-72'} w-full rounded-2xl`} />;
  };
  return (
    <div className={GRID_CLASS[layout]} aria-hidden>
      {Array.from({ length: layout === 'list' ? 4 : 8 }).map((_, i) => cell(i))}
    </div>
  );
}
