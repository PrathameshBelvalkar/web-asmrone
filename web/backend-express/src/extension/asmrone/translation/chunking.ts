const MAX_LENGTH = 1800;

/**
 * Splits strings into chunks of at most 1800 characters (joined with a newline, +1 per join).
 * Port of Kotlin splitIntoChunks, including its +1 accounting and the balancing pass.
 */
export function splitIntoChunks(list: readonly string[]): string[][] {
  const totalLength = list.reduce((sum, s) => sum + s.length, 0) + (list.length - 1);
  if (totalLength <= MAX_LENGTH) return [[...list]];

  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;
  for (const item of list) {
    const itemLength = item.length + (current.length === 0 ? 0 : 1);
    if (currentLength + itemLength > MAX_LENGTH && current.length > 0) {
      chunks.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(item);
    currentLength += itemLength;
  }
  if (current.length > 0) chunks.push(current);

  if (chunks.length > 1) {
    const last = chunks.pop() as string[];
    const secondLast = chunks.pop() as string[];
    if (last.length < Math.trunc(secondLast.length / 3)) {
      const combined = [...secondLast, ...last];
      const halfSize = Math.trunc(combined.length / 2);
      let firstHalfLength = 0;
      let splitIndex = 0;
      for (let i = 0; i < combined.length; i++) {
        const itemLength = (combined[i] ?? '').length + (i > 0 ? 1 : 0);
        if (firstHalfLength + itemLength > MAX_LENGTH || i >= halfSize) {
          splitIndex = i;
          break;
        }
        firstHalfLength += itemLength;
      }
      chunks.push(combined.slice(0, splitIndex), combined.slice(splitIndex));
    } else {
      chunks.push(secondLast, last);
    }
  }
  return chunks;
}
