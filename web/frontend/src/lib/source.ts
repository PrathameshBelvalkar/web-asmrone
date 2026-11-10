import { create } from 'zustand';
import type { SourceId } from '../api/types';

/** The music sources in the sidebar, default first. `asmrone` is asmr.one; `jasmr` is japaneseasmr.com. */
export const SOURCES: readonly { readonly id: SourceId; readonly label: string; readonly site: string }[] = [
  { id: 'asmrone', label: 'asmr.one', site: 'asmr.one' },
  { id: 'jasmr', label: 'Japanese ASMR', site: 'japaneseasmr.com' },
  { id: 'jnet', label: 'JASMR', site: 'jasmr.net' },
  { id: 'hasmr', label: 'Hentai ASMR', site: 'hentaiasmr.moe' },
];

/** Used until the user picks a source. */
const DEFAULT_SOURCE: SourceId = 'asmrone';

const KEY = 'echo:source';

function stored(): SourceId {
  try {
    const saved = localStorage.getItem(KEY);
    return SOURCES.some((s) => s.id === saved) ? (saved as SourceId) : DEFAULT_SOURCE;
  } catch {
    return DEFAULT_SOURCE;
  }
}

interface SourceState {
  readonly source: SourceId;
  readonly setSource: (source: SourceId) => void;
}

/** The source the browse screens use. Remembered per browser. */
export const useSource = create<SourceState>((set) => ({
  source: stored(),
  setSource: (source) => {
    try {
      localStorage.setItem(KEY, source);
    } catch {
      /* storage unavailable: the choice lasts for this visit only */
    }
    set({ source });
  },
}));
