import { create } from 'zustand';
import type { SourceId } from '../api/types';

/** The music sources in the sidebar, default first. `jasmr` is japaneseasmr.com; `asmrone` is asmr.one. */
export const SOURCES: readonly { readonly id: SourceId; readonly label: string; readonly site: string }[] = [
  { id: 'jasmr', label: 'Japanese ASMR', site: 'japaneseasmr.com' },
  { id: 'asmrone', label: 'asmr.one', site: 'asmr.one' },
];

/** Used until the user picks a source. */
const DEFAULT_SOURCE: SourceId = 'jasmr';

const KEY = 'echo:source';

function stored(): SourceId {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'jasmr' || saved === 'asmrone' ? saved : DEFAULT_SOURCE;
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
