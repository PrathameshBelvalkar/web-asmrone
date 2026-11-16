import { create } from 'zustand';

/** JAV preferences, kept on this device. */
interface JavPrefs {
  /** Leave out movies that aren't released yet. On by default. */
  hideUpcoming: boolean;
  setHideUpcoming: (hide: boolean) => void;
}

const KEY = 'echo:jav:prefs';

function load(): { hideUpcoming: boolean } {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const value = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>).hideUpcoming : undefined;
    return { hideUpcoming: typeof value === 'boolean' ? value : true };
  } catch {
    return { hideUpcoming: true };
  }
}

export const useJavPrefs = create<JavPrefs>((set) => ({
  ...load(),
  setHideUpcoming: (hideUpcoming) => {
    set({ hideUpcoming });
    try {
      localStorage.setItem(KEY, JSON.stringify({ hideUpcoming }));
    } catch {
      // Storage can be refused (private windows); the choice still applies until the page closes.
    }
  },
}));
