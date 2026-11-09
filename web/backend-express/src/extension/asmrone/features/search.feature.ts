import type { QuickSearchItem } from '../../../models/echo/quick-search.js';
import type { Tag } from '../api/upstream.schemas.js';
import { replaceAllLiteralIgnoreCase } from '../util/text.js';
import type { ExtensionContext } from './context.js';

/**
 * Quick-search suggestions. Tags typed in the query become "$tag:name$" tokens; the last word
 * suggests completions. Port of the Kotlin quickSearch (including its literal spacing).
 */
export class SearchSuggestions {
  constructor(private readonly ctx: ExtensionContext) {}

  async quickSearch(query: string): Promise<QuickSearchItem[]> {
    const tags = await this.ctx.api.getTags();
    const nameOf = (t: Tag): string => t.i18n['en-us'].name ?? t.name;
    const lowered = query.toLowerCase();

    const usedTags = tags.filter((t) => lowered.includes(nameOf(t).toLowerCase()));
    const combinedUsedTags = usedTags.map((t) => `$tag:${nameOf(t)}$`).join(' ');

    let withoutTags = query.replace(/\$tag:.*?\$/g, '');
    for (const tag of usedTags) withoutTags = replaceAllLiteralIgnoreCase(withoutTags, nameOf(tag), '');
    withoutTags = withoutTags.trim();

    const parts = withoutTags.split(' ');
    const lastWord = parts[parts.length - 1] ?? '';
    const newTags = tags.filter((t) => nameOf(t).toLowerCase().includes(lastWord.toLowerCase()));
    if (newTags.length > 0) withoutTags = parts.slice(0, -1).join(' ');

    const options: QuickSearchItem[] = [
      { kind: 'Query', query: `${combinedUsedTags} ${withoutTags} ${lastWord}`, searched: false, extras: {} },
    ];
    for (const tag of newTags) {
      options.push({
        kind: 'Query',
        query: `${combinedUsedTags} ${withoutTags} $tag:${nameOf(tag)}$`,
        searched: false,
        extras: {},
      });
    }
    return options;
  }
}
