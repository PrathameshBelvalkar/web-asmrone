/** Upstream payloads in the shape asmr.one sends. Only the fields the client reads are needed. */
export function work(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 123,
    title: '[RJ123] Title',
    circle_id: 1,
    name: 'Circle',
    nsfw: false,
    release: '2024-01-02',
    dl_count: 1,
    price: 0,
    review_count: 2,
    rate_count: 3,
    rate_average_2dp: 4,
    rate_count_detail: [],
    has_subtitle: true,
    create_date: '2024-01-02',
    vas: [{ id: 'v1', name: 'VA One' }],
    tags: [{ id: 1, i18n: { 'en-us': { name: 'Tag EN' }, 'ja-jp': { name: 'タグ' }, 'zh-cn': { name: '标签' } }, name: 'タグ' }],
    language_editions: [],
    other_language_editions_in_db: [],
    translation_info: { lang: null },
    work_attributes: '',
    age_category_string: '',
    duration: 100,
    source_type: 'dlsite',
    source_id: 'RJ123',
    source_url: '',
    userRating: 4,
    circle: { id: 1, name: 'Circle', source_id: '1', source_type: 'x' },
    samCoverUrl: 'https://img/s.jpg',
    thumbnailCoverUrl: 'https://img/t.jpg',
    mainCoverUrl: 'https://img/m.jpg',
    ...overrides,
  };
}

export const TAGS = [
  { id: 2, i18n: { 'en-us': { name: 'Zeta' }, 'ja-jp': { name: 'ゼータ' }, 'zh-cn': { name: 'Z' } }, name: 'ゼータ', count: 1 },
  { id: 1, i18n: { 'en-us': { name: 'Alpha' }, 'ja-jp': { name: 'アルファ' }, 'zh-cn': { name: 'A' } }, name: 'アルファ', count: 1 },
];

export function worksResponse(works: Record<string, unknown>[], currentPage = 1, pageSize = 20, totalCount = works.length) {
  return { works, pagination: { currentPage, pageSize, totalCount } };
}

/** A media tree with a "mp3" folder (the main audio folder) and a subtitle file. */
export const TREE = [
  {
    type: 'folder',
    title: 'Scripts',
    children: [
      {
        type: 'text',
        title: 'b.wav.vtt',
        hash: 'hv',
        work: { id: 123, source_id: 'RJ123', source_type: 'dlsite' },
        workTitle: 'Title',
        mediaStreamUrl: 'https://cdn/vtt',
        mediaDownloadUrl: 'https://cdn/dl/sub.vtt',
        size: 1,
        duration: null,
      },
    ],
  },
  {
    type: 'folder',
    title: 'mp3',
    children: [
      {
        type: 'audio',
        title: 'b.wav',
        hash: 'h2',
        work: { id: 123, source_id: 'RJ123', source_type: 'dlsite' },
        workTitle: 'Title',
        mediaStreamUrl: 'https://cdn/s2',
        mediaDownloadUrl: 'https://cdn/d2',
        size: 1,
        duration: 12.5,
        streamLowQualityUrl: null,
      },
      {
        type: 'audio',
        title: 'a.wav',
        hash: 'h1',
        work: { id: 123, source_id: 'RJ123', source_type: 'dlsite' },
        workTitle: 'Title',
        mediaStreamUrl: 'https://cdn/s1',
        mediaDownloadUrl: 'https://cdn/d1',
        size: 1,
        duration: 3,
        streamLowQualityUrl: null,
      },
    ],
  },
];
