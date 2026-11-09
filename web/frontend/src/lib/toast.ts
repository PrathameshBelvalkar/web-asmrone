import { toast as sonner } from 'sonner';

/** Short confirmation or error message, shown by the app's Toaster. */
export const toast = (message: string) => {
  sonner(message);
};
