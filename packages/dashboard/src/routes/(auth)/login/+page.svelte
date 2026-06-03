<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Label from '$lib/components/ui/Label.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
		form: { username: string; error: 'required' | 'server' | 'invalid' } | null;
	}

	let { data, form }: Props = $props();

	const messages = $derived(data.messages);
	let submitting = $state(false);
	const errorText = $derived.by(() => {
		if (!form) return null;
		if (form.error === 'required') return t(messages, 'login.error.required');
		if (form.error === 'server') return t(messages, 'login.error.server');
		if (form.error === 'invalid') return t(messages, 'login.error.invalid');
		return null;
	});
</script>

<svelte:head>
	<title>{t(messages, 'login.title')} · CortexOS</title>
</svelte:head>

<div class="w-full max-w-md">
	<Card>
		{#snippet header()}
			<h1 class="text-xl font-semibold leading-none tracking-tight">
				{t(messages, 'login.title')}
			</h1>
			<p class="text-sm text-muted-foreground">{t(messages, 'login.subtitle')}</p>
		{/snippet}

		<form
			method="POST"
			class="flex flex-col gap-4"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
			data-testid="login-form"
		>
			<div class="flex flex-col gap-1.5">
				<Label for_="username" required>{t(messages, 'login.username')}</Label>
				<Input
					id="username"
					name="username"
					type="text"
					autocomplete="username"
					autofocus
					required
					value={form?.username ?? ''}
					ariaInvalid={form?.error === 'required'}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<Label for_="password" required>{t(messages, 'login.password')}</Label>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					ariaInvalid={form?.error === 'required'}
				/>
			</div>

			{#if errorText}
				<p role="alert" class="text-sm text-destructive" data-testid="login-error">
					{errorText}
				</p>
			{/if}

			<Button
				type="submit"
				variant="default"
				size="md"
				loading={submitting}
				ariaLabel={t(messages, 'login.submit')}
			>
				{submitting ? t(messages, 'login.submitting') : t(messages, 'login.submit')}
			</Button>
		</form>
	</Card>
</div>
