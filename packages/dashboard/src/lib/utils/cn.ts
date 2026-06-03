/**
 * cn — class-name merger. Re-export of clsx + tailwind-merge.
 *
 * Mirrors the existing `cn()` in `packages/dashboard/src/lib/utils.ts` (Next.js).
 * Used by every component to merge user-supplied class strings with our own.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
