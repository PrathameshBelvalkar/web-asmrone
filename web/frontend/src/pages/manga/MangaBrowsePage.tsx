import { useSearchParams } from 'react-router-dom';
import type { MangaListQuery } from '../../api/types';
import { MangaGrid } from '../../components/manga/MangaGrid';
import { Segmented } from '../../components/manga/Segmented';
import { PageHeader } from '../../components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useCrumbs } from '../../lib/crumbs';
import { lastLanguage, MANGA_CATEGORIES, MANGA_LANGUAGES, saveLastLanguage } from '../../lib/manga';

type Sort = 'new' | 'popular';

const FILTER = 'h-9 w-auto min-w-40 rounded-lg border-white/10 bg-white/[0.08] font-medium hover:bg-white/[0.14]';

/**
 * Newest or popular galleries, narrowed to one language or one category. The site lists each on its
 * own, so picking one clears the other. The last language you picked is used next time.
 */
export function MangaBrowsePage() {
  useCrumbs([{ label: 'Manga & Doujinshi' }, { label: 'Browse' }]);
  const [params, setParams] = useSearchParams();
  const sort: Sort = params.get('sort') === 'popular' ? 'popular' : 'new';
  const category = params.get('category');
  // `lang=all` in the address wins over the remembered language.
  const rawLang = params.get('lang') ?? lastLanguage();
  const language = category || rawLang === 'all' ? null : rawLang;

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const chooseLanguage = (value: string) => {
    const lang = value === 'all' ? null : value;
    saveLastLanguage(lang);
    update({ lang: lang ?? 'all', category: null });
  };

  const chooseCategory = (value: string) => {
    update({ category: value === 'all' ? null : value, lang: value === 'all' ? null : 'all' });
  };

  const query: MangaListQuery = category
    ? { by: 'category', slug: category, sort }
    : language
      ? { by: 'language', slug: language, sort }
      : { by: 'browse', sort };

  return (
    <>
      <PageHeader title="Manga & Doujinshi" meta="Browse the newest and most popular galleries." />
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Segmented<Sort>
          label="Sort"
          value={sort}
          onChange={(v) => update({ sort: v === 'new' ? null : v })}
          options={[
            { value: 'new', label: 'Newest' },
            { value: 'popular', label: 'Popular' },
          ]}
        />
        <Select value={language ?? 'all'} onValueChange={chooseLanguage}>
          <SelectTrigger aria-label="Language" className={FILTER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            {MANGA_LANGUAGES.map((l) => (
              <SelectItem key={l.slug} value={l.slug}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category ?? 'all'} onValueChange={chooseCategory}>
          <SelectTrigger aria-label="Category" className={FILTER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {MANGA_CATEGORIES.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <MangaGrid key={JSON.stringify(query)} query={query} />
    </>
  );
}
