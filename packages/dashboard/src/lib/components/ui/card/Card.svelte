<!--
  Card — the canonical container primitive.

  Compound component: <Card> ... <CardHeader> <CardTitle> <CardDescription>
  <CardBody> <CardFooter> ... </Card>. Use the subcomponents to compose
  card-shaped regions consistently.
-->
<script lang="ts" module>
  // Module-level reserved for future top-level exports.
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { tv } from '$lib/utils/tv';
  import { cn } from '$lib/utils/cn';

  type CardSize = 'default' | 'sm';
  type CardProps = HTMLAttributes<HTMLDivElement> & {
    size?: CardSize;
    children?: Snippet;
  };
  let { size = 'default', class: className, children, ...rest }: CardProps = $props();

  const card = tv({
    base: 'group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
    variants: {
      size: {
        default: 'py-4',
        sm: 'gap-3 py-3',
      },
    },
    defaults: { size: 'default' },
  });
  const classes = $derived(card({ size, class: className as string | undefined }));
</script>

<div data-slot="card" data-size={size} class={cn(classes)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
