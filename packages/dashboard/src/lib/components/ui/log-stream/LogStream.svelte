<!--
  LogStream — auto-refreshing scrolling log pane.

  Generates synthetic probe-style log lines on an interval. The stream is
  capped to the most recent 100 lines and auto-scrolls to the bottom.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		height?: number;
		interval?: number;
		class?: string;
	};

	let { height = 360, interval = 1500, class: className = '' }: Props = $props();

	const SERVICES = [
		'cortex-dashboard',
		'postgresql',
		'caddy',
		'docker',
		'tailscaled',
		'grafana',
		'prometheus',
		'loki',
		'incus',
		'hermes'
	];
	const MESSAGES = [
		'probe started',
		'HTTP 200 OK',
		'HTTP 503 Service Unavailable',
		'tcp connect succeeded',
		'tcp connect refused',
		'response time 42 ms',
		'response time 128 ms',
		'recheck requested',
		'status transition: online → offline',
		'status transition: offline → online'
	];

	let lines: string[] = $state([]);
	let pane: HTMLDivElement | null = $state(null);

	onMount(() => {
		const id = setInterval(() => {
			const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
			const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
			const now = new Date();
			const ts = now.toISOString().split('T')[1]?.slice(0, 8) ?? '--:--:--';
			const line = `[${ts}] ${service}: ${message}`;
			lines = [...lines.slice(-99), line];
			requestAnimationFrame(() => {
				if (pane) pane.scrollTop = pane.scrollHeight;
			});
		}, interval);

		return () => clearInterval(id);
	});
</script>

<div
	bind:this={pane}
	class={cn(
		'overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-xs scrollbar-thin',
		className
	)}
	style="height: {height}px;"
>
	{#if lines.length === 0}
		<div class="text-muted-foreground">Waiting for log lines…</div>
	{:else}
		{#each lines as line (line)}
			<div class="whitespace-pre-wrap py-0.5">{line}</div>
		{/each}
	{/if}
</div>
