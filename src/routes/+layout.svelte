<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	
	let { children } = $props();

	// Register service worker
	onMount(() => {
		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/sw.js')
				.then((registration) => {
					console.log('SW registered:', registration);
				})
				.catch((error) => {
					console.log('SW registration failed:', error);
				});
		}
	});
</script>

<svelte:head>
	<title>Tasks — Elegant Productivity</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
	<meta name="description" content="A minimalist task management application with gesture-based interactions" />
	
	<!-- PWA Meta Tags -->
	<meta name="theme-color" content="#0a0a0a" />
	<meta name="background-color" content="#0a0a0a" />
	<meta name="display" content="standalone" />
	<meta name="orientation" content="portrait-primary" />
	
	<!-- Apple PWA Meta Tags -->
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="Tasks" />
	<link rel="apple-touch-icon" href="/icon.svg" />
	
	<!-- Manifest -->
	<link rel="manifest" href="/manifest.json" />
	
	<!-- Favicon -->
	<link rel="icon" href="/icon.svg" type="image/svg+xml" />
	
	<!-- Prevent zoom on input focus (iOS) -->
	<meta name="format-detection" content="telephone=no" />
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
