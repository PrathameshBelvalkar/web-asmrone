import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { javNewsOptions } from '../../api/queries';
import type { JavNewsCategory } from '../../api/types';
import { InfiniteGrid } from '../../components/jav/grid';
import { NewsCard } from '../../components/jav/NewsCard';
import { Segmented } from '../../components/manga/Segmented';
import { PageHeader, Skeleton } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';
import { NEWS_CATEGORIES } from '../../lib/jav';

type Category = JavNewsCategory | 'all';

/** The site's news: weekly top movies and idol debuts, idol and site updates, newest first. */
export function JavNewsPage() {
  useCrumbs([{ label: 'JAV' }, { label: 'News' }]);
  const [params, setParams] = useSearchParams();
  const raw = params.get('category');
  const category: Category = NEWS_CATEGORIES.some((c) => c.value === raw) ? (raw as Category) : 'all';
  const list = useInfiniteQuery(javNewsOptions(category === 'all' ? null : category));
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);

  return (
    <>
      <PageHeader title="News" meta="Weekly charts, new debuts and updates from javdatabase.com." />
      <div className="mb-8">
        <Segmented<Category>
          label="Category"
          value={category}
          onChange={(v) => setParams(v === 'all' ? {} : { category: v }, { replace: true })}
          options={NEWS_CATEGORIES}
        />
      </div>
      <InfiniteGrid
        key={category}
        list={list}
        items={items}
        itemKey={(i) => i.path}
        render={(i) => <NewsCard item={i} />}
        className="grid max-w-4xl gap-4"
        skeleton={
          <div className="grid max-w-4xl gap-4" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        }
        emptyText="No posts in this category."
      />
    </>
  );
}
