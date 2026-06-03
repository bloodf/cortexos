/**
 * cn — class-name merger using clsx + tailwind-merge.
 * Used by every Svelte 5 component to merge user-supplied class strings
 * with our own while resolving tailwind conflicts.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
