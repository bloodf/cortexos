<script lang="ts" module>
	type ToastVariant = 'default' | 'success' | 'warning' | 'destructive';

	interface ToastSpec {
		id: number;
		title: string;
		description?: string;
		variant: ToastVariant;
		durationMs: number;
	}

	const toasts: ToastSpec[] = $state([]);
	let nextId = 1;

	export type ToastOptions = Omit<ToastSpec, 'id' | 'durationMs'> & {
		durationMs?: number;
	};

	export function pushToast(opts: ToastOptions): number {
		const id = nextId++;
		const spec: ToastSpec = {
			id,
			title: opts.title,
			description: opts.description,
			variant: opts.variant,
			durationMs: opts.durationMs ?? 4500
		};
		toasts.push(spec);
		setTimeout(() => dismissToast(id), spec.durationMs);
		return id;
	}

	export function dismissToast(id: number): void {
		const idx = toasts.findIndex((t) => t.id === id);
		if (idx >= 0) toasts.splice(idx, 1);
	}

	export function getToasts(): ToastSpec[] {
		return toasts;
	}
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import X from '$lib/icons/X.svelte';
	import Check from '$lib/icons/Check.svelte';

	const variantClass: Record<ToastVariant, string> = {
		default: 'border-border bg-card text-card-foreground',
		success: 'border-success/40 bg-success/10 text-card-foreground',
		warning: 'border-warning/40 bg-warning/10 text-card-foreground',
		destructive: 'border-destructive/40 bg-destructive/10 text-card-foreground'
	};
</script>

<div
	aria-live="polite"
	aria-atomic="false"
	class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
>
	{#each toasts as t (t.id)}
		<div
			role={t.variant === 'destructive' ? 'alert' : 'status'}
			class={cn(
				'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border p-3 shadow-md',
				variantClass[t.variant]
			)}
		>
			{#if t.variant === 'success'}
				<Check class="mt-0.5 h-4 w-4 text-success" />
			{/if}
			<div class="flex-1 text-sm">
				<p class="font-medium leading-none">{t.title}</p>
				{#if t.description}
					<p class="mt-1 text-muted-foreground">{t.description}</p>
				{/if}
			</div>
			<button
				type="button"
				aria-label="Dismiss"
				class="rounded p-1 text-muted-foreground hover:text-foreground"
				onclick={() => dismissToast(t.id)}
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	{/each}
</div>
