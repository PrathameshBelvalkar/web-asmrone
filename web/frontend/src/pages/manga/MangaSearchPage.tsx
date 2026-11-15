import { FormEvent, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { MangaGrid } from '../../components/manga/MangaGrid';
import { NameSearchResults } from '../../components/manga/NameSearch';
import { Segmented } from '../../components/manga/Segmented';
import { IconButton, PageHeader } from '../../components/ui';
import { searchLabel, useCrumbs } from '../../lib/crumbs';

type Target = 'galleries' | 'tags' | 'artists';

const PLACEHOLDER: Record<Target, string> = {
  galleries: 'Title, artist, or tag:name',
  tags: 'Tag name, for example yuri',
  artists: 'Artist name',
};

/**
 * Search galleries (by title, with `tag:` and `-tag:`), or look up a tag or an artist by name.
 * Gallery searches run on Enter; tag and artist names are matched as you type.
 */
export function MangaSearchPage() {
  const [params, setParams] = useSearchParams();
  const submitted = params.get('q') ?? '';
  const raw = params.get('in');
  const target: Target = raw === 'tags' || raw === 'artists' ? raw : 'galleries';
  useCrumbs(
    submitted
      ? [{ label: 'Manga & Doujinshi', to: '/manga' }, { label: 'Search', to: '/manga/search' }, { label: `“${searchLabel(submitted)}”` }]
      : [{ label: 'Manga & Doujinshi', to: '/manga' }, { label: 'Search' }],
  );
  const [text, setText] = useState(submitted);
  const inputRef = useRef<HTMLInputElement>(null);

  const go = (q: string, to: Target, replace = false) => {
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (to !== 'galleries') next.in = to;
    setParams(next, { replace });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (value) go(value, target);
  };

  const live = target !== 'galleries';

  return (
    <>
      <PageHeader title="Search" />
      <div className="mb-5">
        <Segmented<Target>
          label="Search for"
          value={target}
          onChange={(to) => {
            go(text.trim(), to, true);
            inputRef.current?.focus();
          }}
          options={[
            { value: 'galleries', label: 'Galleries' },
            { value: 'tags', label: 'Tags' },
            { value: 'artists', label: 'Artists' },
          ]}
        />
      </div>
      <form onSubmit={submit} className="relative mb-8" role="search">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // Tag and artist names follow the typing; the address keeps up so Back works.
            if (live) go(e.target.value.trim(), target, true);
          }}
          placeholder={PLACEHOLDER[target]}
          aria-label={`Search ${target}`}
          maxLength={200}
          className="h-12 w-full rounded-full border border-input bg-card pl-11 pr-12 text-base text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:outline-none"
        />
        {text && (
          <IconButton
            icon={X}
            label="Clear search"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => {
              setText('');
              if (live) go('', target, true);
              inputRef.current?.focus();
            }}
          />
        )}
      </form>

      {target === 'galleries' &&
        (submitted ? (
          <MangaGrid key={submitted} query={{ by: 'search', q: submitted }} emptyText="No galleries match this search." />
        ) : (
          <p className="text-sm text-muted-foreground">
            Search by title or artist. Add <span className="text-foreground/80">tag:yuri</span> to require a tag and{' '}
            <span className="text-foreground/80">-tag:yuri</span> to leave one out.
          </p>
        ))}
      {live &&
        (text.trim() ? (
          <NameSearchResults kind={target === 'tags' ? 'tag' : 'artist'} q={text} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Type part of a {target === 'tags' ? 'tag' : 'artist'} name. The first search for a letter can take a few seconds.
          </p>
        ))}
    </>
  );
}
