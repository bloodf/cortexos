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

/**
 * formatBytes — human-readable byte count. Used by file-size widgets.
 * Kept here (instead of in a separate `format.ts`) because it's a small
 * utility that the design system frequently composes with `cn()`.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
