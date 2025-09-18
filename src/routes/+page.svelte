<script lang="ts">
	import {
		getTodos,
		addTodo,
		updateTodo,
		deleteTodo,
	} from "$lib/todos.remote";
	import { browser } from "$app/environment";
	import { onMount } from "svelte";

	let newTodoText = $state("");

	// PWA install prompt
	let deferredPrompt = $state<any>(null);
	let showInstallPrompt = $state(false);

	let newTodoIsHabit = $state(false);
	let newTodoDueDate = $state("");
	let editingId = $state<number | null>(null);
	let editText = $state("");
	let editIsHabit = $state(false);
	let editDueDate = $state("");

	// Swipe state
	let swipeStartX = $state(0);
	let swipeStartY = $state(0);
	let swipeCurrentX = $state(0);
	let swipeItemId = $state<number | null>(null);
	let isSwipeActive = $state(false);

	async function handleAddTodo() {
		if (!newTodoText.trim()) return;

		try {
			await addTodo({
				text: newTodoText.trim(),
				isHabit: newTodoIsHabit,
				dueDate: newTodoDueDate || undefined,
			}).updates(todosQuery);

			// Reset form
			newTodoText = "";
			newTodoIsHabit = false;
			newTodoDueDate = "";
		} catch (error) {
			console.error("Failed to add todo:", error);
		}
	}

	async function handleToggleTodo(id: number, completed: boolean) {
		try {
			await updateTodo({ id, completed: !completed }).updates(todosQuery);
		} catch (error) {
			console.error("Failed to toggle todo:", error);
		}
	}

	async function handleDeleteTodo(id: number) {
		try {
			await deleteTodo(id).updates(todosQuery);
		} catch (error) {
			console.error("Failed to delete todo:", error);
		}
	}

	function startEditing(todo: any) {
		editingId = todo.id;
		editText = todo.text;
		editIsHabit = todo.isHabit;
		editDueDate = todo.dueDate
			? new Date(todo.dueDate).toISOString().split("T")[0]
			: "";
	}

	function cancelEditing() {
		editingId = null;
		editText = "";
		editIsHabit = false;
		editDueDate = "";
	}

	async function saveEdit() {
		if (!editText.trim() || editingId === null) return;

		try {
			await updateTodo({
				id: editingId,
				text: editText.trim(),
				isHabit: editIsHabit,
				dueDate: editDueDate || null,
			}).updates(todosQuery);

			cancelEditing();
		} catch (error) {
			console.error("Failed to update todo:", error);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			handleAddTodo();
		}
	}

	function handleEditKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			saveEdit();
		} else if (event.key === "Escape") {
			cancelEditing();
		}
	}

	// Swipe gesture handlers
	function handleTouchStart(event: TouchEvent, todoId: number) {
		const touch = event.touches[0];
		swipeStartX = touch.clientX;
		swipeStartY = touch.clientY;
		swipeCurrentX = touch.clientX;
		swipeItemId = todoId;
		isSwipeActive = true;
	}

	function handleTouchMove(event: TouchEvent) {
		if (!isSwipeActive || swipeItemId === null) return;

		const touch = event.touches[0];
		const deltaX = touch.clientX - swipeStartX;
		const deltaY = Math.abs(touch.clientY - swipeStartY);

		// Only handle horizontal swipes
		if (deltaY > 30) {
			resetSwipe();
			return;
		}

		swipeCurrentX = touch.clientX;

		// Prevent scrolling during horizontal swipe
		if (Math.abs(deltaX) > 10) {
			event.preventDefault();
		}
	}

	function handleTouchEnd(event: TouchEvent, todo: any) {
		if (!isSwipeActive || swipeItemId !== todo.id) return;

		const deltaX = swipeCurrentX - swipeStartX;
		const threshold = 80;

		if (Math.abs(deltaX) > threshold) {
			if (deltaX < 0) {
				// Swipe left - Edit
				startEditing(todo);
			} else {
				// Swipe right - Delete
				handleDeleteTodo(todo.id);
			}
		}

		resetSwipe();
	}

	function resetSwipe() {
		isSwipeActive = false;
		swipeItemId = null;
		swipeStartX = 0;
		swipeStartY = 0;
		swipeCurrentX = 0;
	}

	function formatDueDate(dateStr: string | Date | null) {
		if (!dateStr) return null;
		const date = new Date(dateStr);
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		if (date.toDateString() === today.toDateString()) return "Today";
		if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year:
				date.getFullYear() !== today.getFullYear()
					? "numeric"
					: undefined,
		});
	}

	const todosQuery = getTodos();

	// Sort todos: incomplete first (by creation date desc), then completed (by creation date desc)
	const sortedTodos = $derived(() => {
		if (!todosQuery.current) return [];

		const incomplete = todosQuery.current.filter((t) => !t.completed);
		const completed = todosQuery.current.filter((t) => t.completed);

		// Sort both groups by creation date (newest first)
		incomplete.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() -
				new Date(a.createdAt).getTime(),
		);
		completed.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() -
				new Date(a.createdAt).getTime(),
		);

		return [...incomplete, ...completed];
	});

	const completedCount = $derived(
		todosQuery.current?.filter((t) => t.completed).length || 0,
	);
	const habitCount = $derived(
		todosQuery.current?.filter((t) => t.isHabit && !t.completed).length ||
			0,
	);

	// PWA install functionality
	onMount(() => {
		if (browser) {
			// Listen for the beforeinstallprompt event
			window.addEventListener("beforeinstallprompt", (e) => {
				e.preventDefault();
				deferredPrompt = e;
				showInstallPrompt = true;
			});

			// Hide install prompt if already installed
			window.addEventListener("appinstalled", () => {
				showInstallPrompt = false;
				deferredPrompt = null;
			});
		}
	});

	async function handleInstallApp() {
		if (!deferredPrompt) return;

		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;

		if (outcome === "accepted") {
			showInstallPrompt = false;
		}

		deferredPrompt = null;
	}

	function dismissInstallPrompt() {
		showInstallPrompt = false;
		deferredPrompt = null;
	}
</script>

<main class="min-h-screen bg-neutral-950 text-neutral-100 font-serif">
	<div class="max-w-md mx-auto px-4 py-8">
		<!-- Header -->
		<header class="mb-8 text-center">
			<h1
				class="text-3xl font-semibold tracking-tight text-neutral-50 mb-1"
			>
				Tasks
			</h1>
			<p class="text-neutral-500 text-sm">
				Tap to complete • Swipe left to edit • Swipe right to delete
			</p>
		</header>

		<!-- PWA Install Prompt -->
		{#if showInstallPrompt}
			<div
				class="mb-6 p-3 bg-neutral-900 border border-neutral-800 rounded-lg"
			>
				<div class="flex items-center justify-between">
					<div class="flex-1">
						<p class="text-neutral-200 text-sm font-medium mb-1">
							Install Tasks
						</p>
						<p class="text-neutral-500 text-xs">
							Add to home screen for quick access
						</p>
					</div>
					<div class="flex items-center space-x-2 ml-3">
						<button
							onclick={handleInstallApp}
							class="px-3 py-1.5 bg-neutral-100 text-neutral-950 text-xs rounded transition-colors duration-200 active:bg-neutral-300"
						>
							Install
						</button>
						<button
							onclick={dismissInstallPrompt}
							class="p-1.5 text-neutral-500 active:text-neutral-300"
							aria-label="Dismiss"
						>
							<svg
								class="w-3 h-3"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Add Todo Form -->
		<section class="mb-8">
			<div class="space-y-3">
				<input
					bind:value={newTodoText}
					onkeydown={handleKeydown}
					placeholder="Add a task..."
					class="w-full bg-transparent border-b border-neutral-800 pb-3 text-lg text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none transition-colors duration-300"
				/>

				<!-- Always visible options -->
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-3">
						<!-- Habit Toggle Button -->
						<button
							onclick={() => (newTodoIsHabit = !newTodoIsHabit)}
							class="px-2 py-1 text-xs rounded transition-all duration-200"
							class:bg-neutral-100={newTodoIsHabit}
							class:text-neutral-950={newTodoIsHabit}
							class:border-neutral-100={newTodoIsHabit}
							class:bg-transparent={!newTodoIsHabit}
							class:text-neutral-500={!newTodoIsHabit}
							class:border-neutral-700={!newTodoIsHabit}
							style="border: 1px solid;"
						>
							毎日
						</button>

						<!-- Due Date -->
						<input
							type="date"
							bind:value={newTodoDueDate}
							placeholder="Due date"
							class="bg-transparent border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-400 focus:border-neutral-600 focus:outline-none"
						/>
					</div>

					<!-- Add Button -->
					{#if newTodoText.trim()}
						<button
							onclick={handleAddTodo}
							class="text-neutral-400 text-xs uppercase tracking-wider transition-colors duration-200 active:text-neutral-200"
						>
							Add
						</button>
					{/if}
				</div>
			</div>
		</section>

		<!-- Todo List -->
		<section class="space-y-0">
			{#if todosQuery.loading}
				<div class="text-center py-12">
					<div
						class="w-5 h-5 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin mx-auto mb-3"
					></div>
					<p class="text-neutral-600 text-sm">Loading...</p>
				</div>
			{:else if todosQuery.error}
				<div class="text-center py-12">
					<p class="text-red-400 text-sm mb-2">Failed to load</p>
					<button
						onclick={() => todosQuery.refresh()}
						class="text-neutral-500 text-xs underline active:text-neutral-300"
					>
						Try again
					</button>
				</div>
			{:else}
				{#each sortedTodos() as todo (todo.id)}
					<article
						class="relative overflow-hidden border-b border-neutral-900 transition-all duration-200"
						class:opacity-60={todo.completed}
						ontouchstart={(e) => handleTouchStart(e, todo.id)}
						ontouchmove={handleTouchMove}
						ontouchend={(e) => handleTouchEnd(e, todo)}
					>
						{#if editingId === todo.id}
							<!-- Edit Mode -->
							<div class="p-4 bg-neutral-900">
								<input
									bind:value={editText}
									onkeydown={handleEditKeydown}
									class="w-full bg-transparent border-b border-neutral-600 pb-2 text-base text-neutral-100 focus:border-neutral-400 focus:outline-none mb-3"
								/>

								<div class="flex items-center justify-between">
									<div class="flex items-center space-x-3">
										<!-- Habit Toggle Button -->
										<button
											onclick={() =>
												(editIsHabit = !editIsHabit)}
											class="px-1.5 py-0.5 text-xs rounded transition-all duration-200"
											class:bg-neutral-100={editIsHabit}
											class:text-neutral-950={editIsHabit}
											class:border-neutral-100={editIsHabit}
											class:bg-transparent={!editIsHabit}
											class:text-neutral-500={!editIsHabit}
											class:border-neutral-700={!editIsHabit}
											style="border: 1px solid;"
										>
											毎日
										</button>

										<!-- Due Date -->
										<input
											type="date"
											bind:value={editDueDate}
											class="bg-transparent border border-neutral-800 rounded px-1 py-0.5 text-xs text-neutral-400 focus:border-neutral-600 focus:outline-none"
										/>
									</div>

									<div class="flex items-center space-x-2">
										<button
											onclick={saveEdit}
											class="text-neutral-400 text-xs uppercase tracking-wider active:text-neutral-200"
										>
											Save
										</button>
										<button
											onclick={cancelEditing}
											class="text-neutral-600 text-xs active:text-neutral-400"
										>
											Cancel
										</button>
									</div>
								</div>
							</div>
						{:else}
							<!-- View Mode - Tap to toggle -->
							<button
								class="w-full p-4 text-left active:bg-neutral-900 transition-colors duration-150"
								onclick={() =>
									handleToggleTodo(todo.id, todo.completed)}
							>
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										<p
											class="text-base text-neutral-200 leading-relaxed transition-colors duration-200"
											class:line-through={todo.completed}
											class:text-neutral-500={todo.completed}
										>
											{todo.text}
										</p>

										<!-- Metadata -->
										{#if todo.isHabit || todo.dueDate}
											<div
												class="flex items-center mt-1 space-x-2"
											>
												{#if todo.isHabit}
													<span
														class="text-xs text-neutral-600 bg-neutral-900 px-1.5 py-0.5 rounded"
													>
														毎日
													</span>
												{/if}
												{#if todo.dueDate}
													<span
														class="text-xs text-neutral-600"
													>
														{formatDueDate(
															todo.dueDate,
														)}
													</span>
												{/if}
											</div>
										{/if}
									</div>

									<!-- Visual indicator for habits -->
									{#if todo.isHabit}
										<div
											class="w-2 h-2 bg-neutral-700 rounded-full mt-2 ml-3 flex-shrink-0"
										></div>
									{/if}
								</div>
							</button>
						{/if}
					</article>
				{:else}
					<div class="text-center py-12">
						<p class="text-neutral-600 text-sm">No tasks yet</p>
					</div>
				{/each}
			{/if}
		</section>

		<!-- Footer Stats -->
		{#if todosQuery.current && todosQuery.current.length > 0}
			<footer class="mt-8 pt-4 border-t border-neutral-900 text-center">
				<p class="text-neutral-600 text-xs">
					{completedCount} of {todosQuery.current?.length || 0} completed
					{#if habitCount > 0}
						• {habitCount} habit{habitCount === 1 ? "" : "s"} pending
					{/if}
				</p>
			</footer>
		{/if}
	</div>
</main>
