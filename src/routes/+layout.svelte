<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Tasks — Elegant Productivity</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="description" content="A minimalist task management application" />
</svelte:head>

<svelte:boundary>
	{@render children?.()}
	
	{#snippet pending()}
		<main class="min-h-screen bg-neutral-950 text-neutral-100 font-serif">
			<div class="max-w-2xl mx-auto px-6 py-16">
				<header class="mb-16 text-center">
					<h1 class="text-4xl font-semibold tracking-tight text-neutral-50 mb-2">
						Tasks
					</h1>
					<p class="text-neutral-400 text-lg italic">
						Loading your tasks...
					</p>
				</header>
				<div class="flex justify-center">
					<div class="w-6 h-6 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin"></div>
				</div>
			</div>
		</main>
	{/snippet}
</svelte:boundary>
