import { Toaster } from './ui/sonner';

/** Mounted once in the shell. Messages come from `toast()` in lib/toast.ts. */
export function Toasts() {
  return <Toaster position="bottom-right" richColors={false} closeButton />;
}
