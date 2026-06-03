// See https://svelte.dev/docs/kit/types#app

import type { User, Session } from '@cortexos/contracts';
import type { Messages } from '$lib/i18n';
import type { ThemePreset, ThemeMode } from '$lib/theme-presets';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
      requestId: string;
    }
    interface PageData {
      user: User | null;
      session: Session | null;
      theme: { preset: ThemePreset; mode: ThemeMode };
      locale: 'en' | 'es' | 'pt-br';
      messages: Messages;
    }
  }
}

export {};
