<!--
  Toast — a single toast message. The Toaster is the queue manager; this is
  the visual primitive. Use `useToaster()` to push a message; the Toaster
  renders the queue.
-->
<script lang="ts" module>
  import { writable, type Writable } from 'svelte/store';

  type ToastVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info';
  export type ToastInput = {
    id?: string;
    title: string;
    description?: string;
    variant?: ToastVariant;
    durationMs?: number;
  };
  export type Toast = Required<Omit<ToastInput, 'description'>> & {
    description?: string;
  };

  const toastsStore: Writable<Toast[]> = writable([]);

  export function useToaster() {
    return {
      subscribe: toastsStore.subscribe,
      push(input: ToastInput) {
        const id = input.id ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const t: Toast = {
          id,
          title: input.title,
          description: input.description,
          variant: input.variant ?? 'default',
          durationMs: input.durationMs ?? 4000,
        };
        toastsStore.update((q) => [...q, t]);
        if (t.durationMs > 0) {
          setTimeout(() => this.dismiss(id), t.durationMs);
        }
        return id;
      },
      dismiss(id: string) {
        toastsStore.update((q) => q.filter((t) => t.id !== id));
      },
      clear() {
        toastsStore.set([]);
      },
    };
  }
</script>

<script lang="ts">
  import { tv } from '$lib/utils/tv';
  import { cn } from '$lib/utils/cn';

  type Props = {
    toast: Toast;
    ondismiss?: () => void;
  };
  let { toast, ondismiss }: Props = $props();

  const toastVariants = tv({
    base: 'pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-md border p-3 shadow-lg ring-1 ring-foreground/10',
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground',
        success: 'border-success/30 bg-success/10 text-foreground',
        warning: 'border-warning/30 bg-warning/10 text-foreground',
        destructive: 'border-destructive/30 bg-destructive/10 text-foreground',
        info: 'border-info/30 bg-info/10 text-foreground',
      },
    },
    defaults: { variant: 'default' },
  });
  const classes = $derived(toastVariants({ variant: toast.variant }));
</script>

<div data-slot="toast" role="status" aria-live="polite" class={cn(classes)}>
  <div class="flex-1 min-w-0">
    <p data-slot="toast-title" class="text-sm font-medium">{toast.title}</p>
    {#if toast.description}
      <p data-slot="toast-description" class="mt-1 text-xs text-muted-foreground">
        {toast.description}
      </p>
    {/if}
  </div>
  <button
    type="button"
    aria-label="Dismiss"
    onclick={ondismiss}
    class="shrink-0 rounded text-muted-foreground hover:text-foreground"
  >&times;</button>
</div>
