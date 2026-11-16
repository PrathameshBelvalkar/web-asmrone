/**
 * Undoes Dean Edwards' packer (`eval(function(p,a,c,k,e,d){…}('…',a,c,'…'.split('|'),0,{}))`) by
 * reading its arguments and swapping each word back. The page's code is never run.
 */

const PACKED =
  /\}\s*\(\s*'((?:\\.|[^'\\])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:\\.|[^'\\])*)'\.split\('\|'\)/s;

/** The unpacked source of the first packed script in `html`, or null when there is none. */
export function unpack(html: string): string | null {
  const start = html.indexOf('eval(function(p,a,c,k,e,');
  if (start < 0) return null;
  const match = PACKED.exec(html.slice(start));
  if (!match) return null;
  const [, rawPayload = '', rawBase = '', rawCount = '', rawWords = ''] = match;
  const base = Number(rawBase);
  const count = Number(rawCount);
  if (base < 2 || base > 62) return null;
  const words = unescapeJs(rawWords).split('|');
  const dictionary = new Map<string, string>();
  for (let n = 0; n < count; n++) {
    const word = words[n];
    if (word) dictionary.set(encode(n, base), word);
  }
  return unescapeJs(rawPayload).replace(/\b\w+\b/g, (w) => dictionary.get(w) ?? w);
}

/** The packer's own number encoding: base `a`, with digits past 35 written as `A`–`Z`. */
function encode(n: number, base: number): string {
  const rest = n % base;
  const digit = rest > 35 ? String.fromCharCode(rest + 29) : rest.toString(36);
  return (n < base ? '' : encode(Math.floor(n / base), base)) + digit;
}

/** A single-quoted JS string's escapes: `\'`, `\"` and `\\`. */
function unescapeJs(text: string): string {
  return text.replace(/\\(['"\\])/g, '$1');
}
