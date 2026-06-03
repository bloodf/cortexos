<!--
  Toaster — renders the toast queue from useToaster(). Mount once at the app
  root. Stacks toasts in the bottom-right.
-->
<script lang="ts">
  import { useToaster } from './Toast.svelte';
  import Toast from './Toast.svelte';
  import { cn } from '$lib/utils/cn';

  const toaster = useToaster();
</script>

<div
  data-slot="toaster"
  aria-live="polite"
  aria-atomic="false"
  class={cn(
    'pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2',
  )}
>
  {#each $toaster as t (t.id)}
    <Toast toast={t} ondismiss={() => toaster.dismiss(t.id)} />
  {/each}
</div>
