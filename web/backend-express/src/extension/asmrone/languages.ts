/**
 * Languages supported by the Google translate endpoint used by the extension.
 * Order, names and codes are read from translator-1.1.2.jar (Language enum), not typed from memory.
 * `name` is the Kotlin enum constant name; it is shown as the setting title.
 */
export interface TranslationLanguage {
  readonly name: string;
  readonly code: string;
}

export const LANGUAGES: readonly TranslationLanguage[] = [
  { name: 'AUTO', code: 'auto' }, { name: 'AFRIKAANS', code: 'af' }, { name: 'ALBANIAN', code: 'sq' },
  { name: 'AMHARIC', code: 'am' }, { name: 'ARABIC', code: 'ar' }, { name: 'ARMENIAN', code: 'hy' },
  { name: 'AZERBAIJANI', code: 'az' }, { name: 'BASQUE', code: 'eu' }, { name: 'BELARUSIAN', code: 'be' },
  { name: 'BENGALI', code: 'bn' }, { name: 'BOSNIAN', code: 'bs' }, { name: 'BULGARIAN', code: 'bg' },
  { name: 'CATALAN', code: 'ca' }, { name: 'CEBUANO', code: 'ceb' }, { name: 'CHICHEWA', code: 'ny' },
  { name: 'CHINESE_SIMPLIFIED', code: 'zh-cn' }, { name: 'CHINESE_TRADITIONAL', code: 'zh-tw' },
  { name: 'CORSICAN', code: 'co' }, { name: 'CROATIAN', code: 'hr' }, { name: 'CZECH', code: 'cs' },
  { name: 'DANISH', code: 'da' }, { name: 'DUTCH', code: 'nl' }, { name: 'ENGLISH', code: 'en' },
  { name: 'ESPERANTO', code: 'eo' }, { name: 'ESTONIAN', code: 'et' }, { name: 'FILIPINO', code: 'tl' },
  { name: 'FINNISH', code: 'fi' }, { name: 'FRENCH', code: 'fr' }, { name: 'FRISIAN', code: 'fy' },
  { name: 'GALICIAN', code: 'gl' }, { name: 'GEORGIAN', code: 'ka' }, { name: 'GERMAN', code: 'de' },
  { name: 'GREEK', code: 'el' }, { name: 'GUJARATI', code: 'gu' }, { name: 'HATIAN_CREOLE', code: 'ht' },
  { name: 'HAUSA', code: 'ha' }, { name: 'HAWAIIAN', code: 'haw' }, { name: 'HEBREW_IW', code: 'iw' },
  { name: 'HEBREW_HE', code: 'he' }, { name: 'HINDI', code: 'hi' }, { name: 'HMONG', code: 'hm' },
  { name: 'HUNGARIAN', code: 'hu' }, { name: 'ICELANDIC', code: 'is' }, { name: 'IGBO', code: 'ig' },
  { name: 'INDONESIAN', code: 'id' }, { name: 'IRISH', code: 'ga' }, { name: 'ITALIAN', code: 'it' },
  { name: 'JAPANESE', code: 'ja' }, { name: 'JAVANESE', code: 'jw' }, { name: 'KANNADA', code: 'kn' },
  { name: 'KAZAKH', code: 'kk' }, { name: 'KHMER', code: 'km' }, { name: 'KOREAN', code: 'ko' },
  { name: 'KURDISH_KURMANJI', code: 'ku' }, { name: 'KYRGYZ', code: 'ky' }, { name: 'LAO', code: 'lo' },
  { name: 'LATIN', code: 'la' }, { name: 'LATVIAN', code: 'lv' }, { name: 'LITHUANIAN', code: 'lt' },
  { name: 'LUXEMBOURGISH', code: 'lb' }, { name: 'MACEDONIAN', code: 'mk' }, { name: 'MALAGASY', code: 'mg' },
  { name: 'MALAY', code: 'ms' }, { name: 'MALAYALAM', code: 'ml' }, { name: 'MALTESE', code: 'mt' },
  { name: 'MAORI', code: 'mi' }, { name: 'MARATHI', code: 'mr' }, { name: 'MONGOLIAN', code: 'mn' },
  { name: 'MYANMAR_BURMESE', code: 'my' }, { name: 'NEPALI', code: 'ne' }, { name: 'NORWEGIAN', code: 'no' },
  { name: 'ODIA', code: 'or' }, { name: 'PASHTO', code: 'ps' }, { name: 'PERSIAN', code: 'fa' },
  { name: 'POLISH', code: 'pl' }, { name: 'PORTUGUESE', code: 'pt' }, { name: 'PUNJABI', code: 'pa' },
  { name: 'ROMANIAN', code: 'ro' }, { name: 'RUSSIAN', code: 'ru' }, { name: 'SAMOAN', code: 'sm' },
  { name: 'SCOTS_GAELIC', code: 'gd' }, { name: 'SERBIAN', code: 'sr' }, { name: 'SESOTHO', code: 'st' },
  { name: 'SHONA', code: 'sn' }, { name: 'SINDHI', code: 'sd' }, { name: 'SINHALA', code: 'si' },
  { name: 'SLOVAK', code: 'sk' }, { name: 'SLOVENIAN', code: 'sl' }, { name: 'SOMALI', code: 'so' },
  { name: 'SPANISH', code: 'es' }, { name: 'SUDANESE', code: 'su' }, { name: 'SWAHILI', code: 'sw' },
  { name: 'SWEDISH', code: 'sv' }, { name: 'TAJIK', code: 'tg' }, { name: 'TAMIL', code: 'ta' },
  { name: 'TELUGU', code: 'te' }, { name: 'THAI', code: 'th' }, { name: 'TURKISH', code: 'tr' },
  { name: 'UKRAINIAN', code: 'uk' }, { name: 'URDU', code: 'ur' }, { name: 'UYGHUR', code: 'ug' },
  { name: 'UZBEK', code: 'uz' }, { name: 'VIETNAMESE', code: 'vi' }, { name: 'WELSH', code: 'cy' },
  { name: 'XHOSA', code: 'xh' }, { name: 'YIDDISH', code: 'yi' }, { name: 'YORUBA', code: 'yo' },
  { name: 'ZULU', code: 'zu' },
];

export const ENGLISH: TranslationLanguage = { name: 'ENGLISH', code: 'en' };

/** Languages offered as the translation target (the Kotlin settings list excludes AUTO). */
export function targetLanguages(): TranslationLanguage[] {
  return LANGUAGES.filter((l) => l.code !== 'auto').sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Kotlin getTranslationLanguage(): unknown or missing code falls back to English. */
export function languageForCode(code: string | null): TranslationLanguage {
  if (code === null) return ENGLISH;
  return LANGUAGES.find((l) => l.code === code) ?? ENGLISH;
}
