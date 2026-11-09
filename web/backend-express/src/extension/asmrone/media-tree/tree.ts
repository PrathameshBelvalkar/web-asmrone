/**
 * Media tree of one work (asmr.one `/tracks/{id}`). Mutable on purpose: titles are translated in
 * place, as the Kotlin implementation does. Port of MediaTreeItem plus FolderOps.kt.
 */

/** Work reference on a file node. Field names follow the upstream payload. */
export interface FolderWork {
  readonly id: number;
  readonly source_id: string;
  readonly source_type: string;
}

interface NodeBase {
  title: string;
  /** Title before translation. Used for matching and as the category id. */
  untranslatedTitle: string;
}

export interface FolderNode extends NodeBase {
  readonly type: 'folder';
  children: MediaNode[];
}

interface FileFields extends NodeBase {
  readonly hash: string;
  readonly work: FolderWork;
  readonly workTitle: string;
  readonly mediaStreamUrl: string;
  readonly mediaDownloadUrl: string;
  readonly size: number;
}

export interface AudioNode extends FileFields {
  readonly type: 'audio';
  readonly streamLowQualityUrl: string | null;
  readonly duration: number;
}

export interface TextNode extends FileFields {
  readonly type: 'text';
  readonly duration: number | null;
}

export interface ImageNode extends FileFields {
  readonly type: 'image';
}

export interface OtherNode extends FileFields {
  readonly type: 'other';
}

export type MediaNode = FolderNode | AudioNode | TextNode | ImageNode | OtherNode;

export function folder(title: string, children: MediaNode[]): FolderNode {
  return { type: 'folder', title, untranslatedTitle: title, children };
}

/** Immutable-style lookup helper: the folder at `path` ("a/b"), or the last valid ancestor. */
export function getFolder(root: FolderNode, path: string): FolderNode {
  let current = root;
  for (const element of path.split('/')) {
    const next = current.children.find((c): c is FolderNode => c.type === 'folder' && c.title === element);
    if (!next) break;
    current = next;
  }
  return current;
}

/** Titles of audio and folder nodes, depth-first (folder title, then its children). */
export function getAllTitles(node: FolderNode): string[] {
  const result: string[] = [];
  for (const item of node.children) {
    if (item.type === 'audio') {
      result.push(item.title);
    } else if (item.type === 'folder') {
      result.push(item.title, ...getAllTitles(item));
    }
  }
  return result;
}

/**
 * Deep copy for cache reuse. Titles and untranslatedTitle are both preserved. (The Kotlin
 * deepCopy reset untranslatedTitle to the translated title, which changed category ids between a
 * fresh load and a cache hit.)
 */
export function deepCopy(node: FolderNode): FolderNode {
  return {
    type: 'folder',
    title: node.title,
    untranslatedTitle: node.untranslatedTitle,
    children: node.children.map((c) => (c.type === 'folder' ? deepCopy(c) : { ...c })),
  };
}

export function getAllAudioFiles(node: FolderNode, recursively: boolean): AudioNode[] {
  const result: AudioNode[] = [];
  for (const item of node.children) {
    if (item.type === 'audio') {
      result.push(item);
    } else if (item.type === 'folder' && recursively) {
      result.push(...item.children.filter((c): c is AudioNode => c.type === 'audio'));
      for (const sub of item.children) {
        if (sub.type === 'folder') result.push(...getAllAudioFiles(sub, true));
      }
    }
  }
  return result;
}

/** Path of the folder named "mp3" with the most direct audio, else the folder with most audio. */
export function findMainAudioFolder(root: FolderNode): string | null {
  const mp3Paths = findAllFoldersWithTitle(root, 'mp3');
  if (mp3Paths.length > 0) {
    let best: { path: string; count: number } | null = null;
    for (const path of mp3Paths) {
      const count = getAllAudioFiles(getFolder(root, path), false).length;
      if (count > 0 && (best === null || count > best.count)) best = { path, count };
    }
    if (best) return best.path;
  }
  return findFolderWithMostAudioFiles(root, '').path;
}

export function findAllFoldersWithTitle(node: FolderNode, title: string, currentPath = ''): string[] {
  const result: string[] = [];
  for (const item of node.children) {
    if (item.type !== 'folder') continue;
    const itemPath = currentPath === '' ? item.title : `${currentPath}/${item.title}`;
    if (item.title.toLowerCase() === title.toLowerCase()) {
      result.push(itemPath);
    } else {
      result.push(...findAllFoldersWithTitle(item, title, itemPath));
    }
  }
  return result;
}

export function findFolderWithMostAudioFiles(
  node: FolderNode,
  currentPath: string,
): { path: string | null; count: number } {
  let maxCount = 0;
  let maxPath: string | null = null;
  const direct = getAllAudioFiles(node, false).length;
  if (direct > 0) {
    maxCount = direct;
    maxPath = currentPath;
  }
  for (const item of node.children) {
    if (item.type !== 'folder') continue;
    const itemPath = currentPath === '' ? item.title : `${currentPath}/${item.title}`;
    const sub = findFolderWithMostAudioFiles(item, itemPath);
    if (sub.path !== null && sub.count > maxCount) {
      maxCount = sub.count;
      maxPath = sub.path;
    }
  }
  return { path: maxPath, count: maxCount };
}

/** The folder directly containing the audio node with `hash`. */
export function findFolderWithAudio(node: FolderNode, hash: string): FolderNode | null {
  for (const item of node.children) {
    if (item.type === 'audio' && item.hash === hash) return node;
    if (item.type === 'folder') {
      const found = findFolderWithAudio(item, hash);
      if (found) return found;
    }
  }
  return null;
}

/** First node (any type) whose title or untranslated title equals `title`. Depth-first. */
export function findFile(node: FolderNode, title: string): MediaNode | null {
  for (const item of node.children) {
    if (item.title === title || item.untranslatedTitle === title) return item;
    if (item.type === 'folder') {
      const found = findFile(item, title);
      if (found) return found;
    }
  }
  return null;
}

/** Applies a title translation map to audio and folder titles (not text, image or other). */
export function applyTranslations(node: FolderNode, translations: ReadonlyMap<string, string>): void {
  for (const item of node.children) {
    if (item.type === 'audio') {
      item.title = translations.get(item.title) ?? item.title;
    } else if (item.type === 'folder') {
      item.title = translations.get(item.title) ?? item.title;
      applyTranslations(item, translations);
    }
  }
}
