/** Code-unit string ordering, the same as Kotlin/Java String.compareTo (not locale-aware). */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortByText<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((x, y) => compareText(key(x), key(y)));
}

/**
 * Java URLEncoder parity for keywords in a URL path. encodeURIComponent leaves `!'()~` alone;
 * URLEncoder encodes them, and encodes space as %20 (the Kotlin code replaces "+" with %20).
 */
export function encodeKeyword(value: string): string {
  return encodeURIComponent(value).replace(/[!'()~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Kotlin Double.toString: whole numbers keep one decimal place ("4.0"). */
export function kotlinDoubleToString(value: number): string {
  if (Number.isInteger(value)) return value.toFixed(1);
  return String(value);
}

/** Case-insensitive, literal (non-regex) replace of every occurrence. */
export function replaceAllLiteralIgnoreCase(text: string, needle: string, replacement: string): string {
  if (needle.length === 0) return text;
  return text.replace(new RegExp(escapeRegExp(needle), 'gi'), replacement);
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Kotlin String.toBoolean(): true only for "true" (case-insensitive). */
export function parseKotlinBoolean(value: string): boolean {
  return value.toLowerCase() === 'true';
}
