<!--
  AgentStateBadge — pulsing colored dot for agent run state.
-->
<script lang="ts">
	export type AgentRunState = 'running' | 'idle' | 'stopped' | 'error';

	type Props = {
		state: AgentRunState;
	};

	let { state }: Props = $props();

	const tone: Record<AgentRunState, string> = {
		running: 'bg-success',
		idle: 'bg-muted-foreground',
		stopped: 'bg-muted-foreground/50',
		error: 'bg-destructive',
	};
</script>

<span class="relative inline-flex items-center justify-center">
	<span
		class="size-2.5 rounded-full ring-2 ring-background {tone[state]}"
		class:animate-pulse={state === 'running'}
		aria-hidden="true"
	></span>
</span>
