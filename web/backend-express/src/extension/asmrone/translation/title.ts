/** Moves a leading bracketed group ("[RJ123] Title", "【x】Title") to the end. Kotlin moveFirstGroupToEnd. */
export function moveFirstGroupToEnd(text: string): string {
  const match = /^([[【][^\]】]*[\]】])/.exec(text);
  if (!match) return text;
  const group = match[1] ?? '';
  return text.replace(group, '') + group;
}
