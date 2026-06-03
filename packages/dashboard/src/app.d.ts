// See https://svelte.dev/docs/kit/types#app

import type { User } from '@cortexos/contracts';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      requestId: string;
    }
    interface PageData {
      user: User | null;
      theme: 'light' | 'dark' | 'system';
      locale: 'en' | 'es' | 'pt-br';
      messages: Record<string, string>;
    }
  }
}

export {};
