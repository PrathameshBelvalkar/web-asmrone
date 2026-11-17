/**
 * Content rules shared by the Manga and JAV areas. They are fixed in the code, not settings.
 */

/**
 * Words that name a blocked tag or a variant of one (`loli`, `lolibaba`, `shota`), matched anywhere
 * in a search, a tag name or a tag slug. `shota` followed by `r` is left alone: Shotaro is a common
 * Japanese given name.
 */
export const BLOCKED_WORD = /loli|shota(?!r)|toddler/i;

const CHILD_TITLE_WORDS = [
  'loli',
  'shota(?!r)',
  'toddler',
  'elementary school',
  'grade school',
  'middle school',
  'junior high',
  '\\bJ[SC]\\b',
  '\\bchild(?:ren)?\\b',
  '\\bkids?\\b',
  '小学',
  '中学',
  '女子中',
  '男子中',
  '幼女',
  '幼児',
  '幼稚園',
  '園児',
  'ロリ',
  'ショタ',
  '児童',
  '初中',
  '萝莉',
  '正太',
];

/**
 * Titles that say the characters are children: school years below high school and words for young
 * children, in English, Japanese and Chinese. Tags are incomplete on the sites, so titles are checked too.
 */
export const BLOCKED_TITLE = new RegExp(CHILD_TITLE_WORDS.join('|'), 'i');

/**
 * JAV titles also name the school roles whose genres are blocked (schoolgirl, school and sailor
 * uniforms), since list cards carry the title but not the genres.
 */
export const BLOCKED_JAV_TITLE = new RegExp(
  [
    ...CHILD_TITLE_WORDS,
    'school ?girls?',
    'school uniform',
    'sailor uniform',
    'school swimsuit',
    '\\bJK\\b',
    '女子校生',
    '女子高生',
    'セーラー服',
    'スク水',
  ].join('|'),
  'i',
);
