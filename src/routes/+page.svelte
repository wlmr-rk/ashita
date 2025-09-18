<script lang="ts">
	import {
		getTodos,
		addTodo,
		updateTodo,
		deleteTodo,
	} from "$lib/todos.remote";

	let newTodoText = $state("");

	let newTodoIsHabit = $state(false);
	let newTodoDueDate = $state("");
	let editingId = $state<number | null>(null);
	let editText = $state("");
	let editIsHabit = $state(false);
	let editDueDate = $state("");

	// Optimistic updates state
	let optimisticTodos = $state<any[]>([]);
	let nextOptimisticId = $state(-1); // Use negative IDs for optimistic items

	// Modal state
	let showAddModal = $state(false);

	// Swipe state with animation
	let swipeStartX = $state(0);
	let swipeStartY = $state(0);
	let swipeCurrentX = $state(0);
	let swipeItemId = $state<number | null>(null);
	let isSwipeActive = $state(false);
	let swipeOffset = $state(0);
	let swipeDirection = $state<"left" | "right" | null>(null);

	async function handleAddTodo() {
		if (!newTodoText.trim()) return;

		// Create optimistic todo immediately
		const optimisticTodo = {
			id: nextOptimisticId--,
			text: newTodoText.trim(),
			completed: false,
			isHabit: newTodoIsHabit,
			dueDate: newTodoDueDate ? new Date(newTodoDueDate) : null,
			createdAt: new Date(),
			isOptimistic: true,
		};

		// Add to optimistic state immediately
		optimisticTodos = [optimisticTodo, ...optimisticTodos];

		// Store form values for potential rollback
		const formData = {
			text: newTodoText.trim(),
			isHabit: newTodoIsHabit,
			dueDate: newTodoDueDate || undefined,
		};

		// Reset form and close modal immediately for better UX
		newTodoText = "";
		newTodoIsHabit = false;
		newTodoDueDate = "";
		closeAddModal();

		try {
			// Send to server in background
			await addTodo(formData).updates(todosQuery);

			// Remove optimistic item once server responds
			optimisticTodos = optimisticTodos.filter(
				(t) => t.id !== optimisticTodo.id,
			);
		} catch (error) {
			console.error("Failed to add todo:", error);

			// Rollback optimistic update on error
			optimisticTodos = optimisticTodos.filter(
				(t) => t.id !== optimisticTodo.id,
			);

			// Restore form data
			newTodoText = formData.text;
			newTodoIsHabit = formData.isHabit;
			newTodoDueDate = formData.dueDate || "";
		}
	}

	async function handleToggleTodo(id: number, completed: boolean) {
		// Optimistic update - toggle immediately
		const newCompleted = !completed;

		// Update optimistic state if it's an optimistic todo
		if (id < 0) {
			optimisticTodos = optimisticTodos.map((t) =>
				t.id === id ? { ...t, completed: newCompleted } : t,
			);
			return; // Don't send to server for optimistic items
		}

		// For real todos, use optimistic update with server sync
		try {
			await updateTodo({ id, completed: newCompleted }).updates(
				todosQuery.withOverride((todos) =>
					todos.map((t) =>
						t.id === id ? { ...t, completed: newCompleted } : t,
					),
				),
			);
		} catch (error) {
			console.error("Failed to toggle todo:", error);
			// The override will automatically revert on error
		}
	}

	async function handleDeleteTodo(id: number) {
		// Optimistic delete - remove immediately
		if (id < 0) {
			// Remove from optimistic state
			optimisticTodos = optimisticTodos.filter((t) => t.id !== id);
			return; // Don't send to server for optimistic items
		}

		// For real todos, use optimistic delete with server sync
		try {
			await deleteTodo(id).updates(
				todosQuery.withOverride((todos) =>
					todos.filter((t) => t.id !== id),
				),
			);
		} catch (error) {
			console.error("Failed to delete todo:", error);
			// The override will automatically revert on error
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

		const updates = {
			text: editText.trim(),
			isHabit: editIsHabit,
			dueDate: editDueDate ? new Date(editDueDate) : null,
		};

		// Handle optimistic todos
		if (editingId < 0) {
			optimisticTodos = optimisticTodos.map((t) =>
				t.id === editingId ? { ...t, ...updates } : t,
			);
			cancelEditing();
			return;
		}

		// For real todos, use optimistic update
		try {
			await updateTodo({
				id: editingId,
				...updates,
			}).updates(
				todosQuery.withOverride((todos) =>
					todos.map((t) =>
						t.id === editingId ? { ...t, ...updates } : t,
					),
				),
			);

			cancelEditing();
		} catch (error) {
			console.error("Failed to update todo:", error);
			// Keep edit mode open on error so user can retry
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			handleAddTodo();
		}
	}

	function openAddModal() {
		showAddModal = true;
		// Reset form
		newTodoText = "";
		newTodoIsHabit = false;
		newTodoDueDate = "";
	}

	function closeAddModal() {
		showAddModal = false;
	}

	function handleModalKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			closeAddModal();
		} else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
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

	// Improved swipe gesture handlers with animations
	function handleTouchStart(event: TouchEvent, todoId: number) {
		// Prevent default to avoid conflicts with browser gestures
		event.preventDefault();

		const touch = event.touches[0];
		swipeStartX = touch.clientX;
		swipeStartY = touch.clientY;
		swipeCurrentX = touch.clientX;
		swipeItemId = todoId;
		isSwipeActive = true;
		swipeOffset = 0;
		swipeDirection = null;
	}

	function handleTouchMove(event: TouchEvent) {
		if (!isSwipeActive || swipeItemId === null) return;

		const touch = event.touches[0];
		const deltaX = touch.clientX - swipeStartX;
		const deltaY = Math.abs(touch.clientY - swipeStartY);

		// If vertical movement is too much, cancel swipe
		if (deltaY > 50) {
			resetSwipe();
			return;
		}

		swipeCurrentX = touch.clientX;

		// Update swipe offset for animation (limit to reasonable range)
		swipeOffset = Math.max(-120, Math.min(120, deltaX));

		// Determine swipe direction for visual feedback
		if (Math.abs(deltaX) > 10) {
			swipeDirection = deltaX < 0 ? "left" : "right";
		}

		// Prevent scrolling during horizontal swipe
		if (Math.abs(deltaX) > 20) {
			event.preventDefault();
		}
	}

	function handleTouchEnd(_event: TouchEvent, todo: any) {
		if (!isSwipeActive || swipeItemId !== todo.id) return;

		const deltaX = swipeCurrentX - swipeStartX;
		const threshold = 60; // Reduced threshold for easier swiping

		if (Math.abs(deltaX) > threshold) {
			if (deltaX < 0) {
				// Swipe left - Edit (animate out then edit)
				animateSwipeComplete("left", () => startEditing(todo));
			} else {
				// Swipe right - Delete (animate out then delete)
				animateSwipeComplete("right", () => handleDeleteTodo(todo.id));
			}
		} else {
			// Snap back to original position
			animateSwipeReset();
		}
	}

	function animateSwipeComplete(
		direction: "left" | "right",
		callback: () => void,
	) {
		// Animate to full swipe
		swipeOffset = direction === "left" ? -200 : 200;

		// Execute callback after animation
		setTimeout(() => {
			callback();
			resetSwipe();
		}, 200);
	}

	function animateSwipeReset() {
		// Animate back to center
		swipeOffset = 0;

		// Reset after animation
		setTimeout(() => {
			resetSwipe();
		}, 200);
	}

	function resetSwipe() {
		isSwipeActive = false;
		swipeItemId = null;
		swipeStartX = 0;
		swipeStartY = 0;
		swipeCurrentX = 0;
		swipeOffset = 0;
		swipeDirection = null;
	}

	// Get swipe transform for current item
	function getSwipeTransform(todoId: number) {
		if (swipeItemId === todoId && isSwipeActive) {
			return `translateX(${swipeOffset}px)`;
		}
		return "translateX(0px)";
	}

	// Get swipe background color based on direction
	function getSwipeBackground(todoId: number) {
		if (swipeItemId !== todoId || !isSwipeActive) return "";

		if (swipeDirection === "left") {
			// Edit - blue background
			const opacity = Math.min(Math.abs(swipeOffset) / 100, 0.3);
			return `rgba(59, 130, 246, ${opacity})`;
		} else if (swipeDirection === "right") {
			// Delete - red background
			const opacity = Math.min(Math.abs(swipeOffset) / 100, 0.3);
			return `rgba(239, 68, 68, ${opacity})`;
		}
		return "";
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

	// Sort todos: include optimistic items + server items, incomplete first
	const sortedTodos = $derived(() => {
		const serverTodos = todosQuery.current || [];
		const allTodos = [...optimisticTodos, ...serverTodos];

		const incomplete = allTodos.filter((t) => !t.completed);
		const completed = allTodos.filter((t) => t.completed);

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

	const completedCount = $derived(() => {
		const serverTodos = todosQuery.current || [];
		const allTodos = [...optimisticTodos, ...serverTodos];
		return allTodos.filter((t) => t.completed).length;
	});

	const habitCount = $derived(() => {
		const serverTodos = todosQuery.current || [];
		const allTodos = [...optimisticTodos, ...serverTodos];
		return allTodos.filter((t) => t.isHabit && !t.completed).length;
	});

	const totalCount = $derived(() => {
		const serverTodos = todosQuery.current || [];
		return optimisticTodos.length + serverTodos.length;
	});
</script>

<main class="min-h-screen bg-neutral-950 text-neutral-100 font-serif pb-24">
	<div class="max-w-md mx-auto px-6 py-8">
		<!-- Todo List -->
		<section class="space-y-2">
			{#if todosQuery.loading}
				<div class="text-center py-16">
					<div
						class="w-6 h-6 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin mx-auto mb-4 depth-1"
					></div>
					<p class="text-neutral-600 text-sm">Loading...</p>
				</div>
			{:else if todosQuery.error}
				<div class="text-center py-16">
					<p class="text-red-400 text-sm mb-3">Failed to load</p>
					<button
						onclick={() => todosQuery.refresh()}
						class="text-neutral-500 text-xs underline active:text-neutral-300 hover:text-neutral-400 transition-colors duration-200"
					>
						Try again
					</button>
				</div>
			{:else}
				{#each sortedTodos() as todo (todo.id)}
					<article
						class="relative overflow-hidden border-b border-neutral-900 touch-manipulation depth-1 mb-1 rounded-lg"
						class:opacity-60={todo.completed}
						class:opacity-80={todo.isOptimistic}
						ontouchstart={(e) => handleTouchStart(e, todo.id)}
						ontouchmove={(e) => handleTouchMove(e)}
						ontouchend={(e) => handleTouchEnd(e, todo)}
						style="touch-action: pan-y; background-color: {getSwipeBackground(
							todo.id,
						)}; transition: {isSwipeActive &&
						swipeItemId === todo.id
							? 'none'
							: 'all 0.2s ease-out'};"
					>
						<!-- Swipe Action Indicators -->
						{#if isSwipeActive && swipeItemId === todo.id}
							<!-- Left swipe indicator (Edit) -->
							{#if swipeDirection === "left"}
								<div
									class="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-400 text-xs opacity-70"
								>
									<svg
										class="w-4 h-4"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<path
											d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
										/>
									</svg>
								</div>
							{/if}

							<!-- Right swipe indicator (Delete) -->
							{#if swipeDirection === "right"}
								<div
									class="absolute left-4 top-1/2 transform -translate-y-1/2 text-red-400 text-xs opacity-70"
								>
									<svg
										class="w-4 h-4"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<path
											fill-rule="evenodd"
											d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
							{/if}
						{/if}
						{#if editingId === todo.id}
							<!-- Edit Mode -->
							<div
								class="p-4 bg-neutral-900 border-highlight inset-depth"
								style="transform: {getSwipeTransform(todo.id)}; transition: {isSwipeActive && swipeItemId === todo.id ? 'none' : 'transform 0.2s ease-out'};"
							>
								<input
									bind:value={editText}
									onkeydown={handleEditKeydown}
									class="w-full bg-transparent border-b border-neutral-600 pb-2 text-base text-neutral-100 focus:border-neutral-400 focus:outline-none mb-3 focus:depth-1"
								/>

								<div class="flex items-center justify-between">
									<div class="flex items-center space-x-3">
										<!-- Habit Toggle Button -->
										<button
											onclick={() =>
												(editIsHabit = !editIsHabit)}
											class="px-1.5 py-0.5 text-xs rounded transition-all duration-200 depth-1"
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
											class="bg-transparent border border-neutral-800 rounded px-1 py-0.5 text-xs text-neutral-400 focus:border-neutral-600 focus:outline-none inset-depth"
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
								class="w-full p-4 text-left active:bg-neutral-900 transition-colors duration-150 hover:depth-2"
								onclick={() =>
									handleToggleTodo(todo.id, todo.completed)}
								style="transform: {getSwipeTransform(
									todo.id,
								)}; transition: {isSwipeActive &&
								swipeItemId === todo.id
									? 'none'
									: 'transform 0.2s ease-out'};"
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
					<div class="text-center py-16">
						<p class="text-neutral-600 text-base">No tasks yet</p>
						<p class="text-neutral-700 text-sm mt-2">Tap the + button to add your first task</p>
					</div>
				{/each}
			{/if}
		</section>

		<!-- Footer Stats -->
		{#if totalCount() > 0}
			<footer class="mt-12 pt-6 border-t border-neutral-900 text-center">
				<div class="bg-neutral-900 rounded-xl px-4 py-3 inline-block depth-1">
					<p class="text-neutral-500 text-sm">
						{completedCount()} of {totalCount()} completed
						{#if habitCount() > 0}
							• {habitCount()} habit{habitCount() === 1 ? "" : "s"} pending
						{/if}
					</p>
				</div>
			</footer>
		{/if}
	</div>

	<!-- Bottom Navigation -->
	<nav
		class="fixed bottom-0 left-0 right-0 bg-neutral-950 border-t border-neutral-900 depth-4"
	>
		<div class="max-w-md mx-auto px-4 py-6 flex justify-center">
			<button
				onclick={openAddModal}
				class="w-16 h-16 bg-neutral-100 text-neutral-950 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 depth-4 hover:depth-5"
				aria-label="Add new task"
			>
				<svg
					class="w-7 h-7"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					stroke-width="2.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 4v16m8-8H4"
					/>
				</svg>
			</button>
		</div>
	</nav>

	<!-- Add Task Modal -->
	{#if showAddModal}
		<div
			class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 modal-backdrop"
			onclick={closeAddModal}
			role="dialog"
			aria-modal="true"
			aria-label="Add new task"
		>
			<div
				class="bg-neutral-900 rounded-3xl w-full max-w-sm mx-6 p-10 modal-content depth-5 border-highlight"
				onclick={(e) => e.stopPropagation()}
				onkeydown={handleModalKeydown}
				role="dialog"
			>
				<!-- Minimal Task Input -->
				<div class="space-y-8">
					<input
						bind:value={newTodoText}
						onkeydown={handleKeydown}
						placeholder="What needs to be done?"
						class="w-full bg-transparent border-none text-2xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none text-center py-2"
					/>

					<!-- Options with more breathing room -->
					<div class="space-y-6 pt-4">
						<!-- Habit Toggle -->
						<div class="flex items-center justify-between py-2">
							<span class="text-neutral-400 text-base">Daily habit</span>
							<button
								onclick={() => (newTodoIsHabit = !newTodoIsHabit)}
								class="px-4 py-2 text-sm rounded-full transition-all duration-200 depth-2"
								class:bg-neutral-100={newTodoIsHabit}
								class:text-neutral-950={newTodoIsHabit}
								class:bg-neutral-800={!newTodoIsHabit}
								class:text-neutral-400={!newTodoIsHabit}
							>
								毎日
							</button>
						</div>

						<!-- Due Date -->
						<div class="flex items-center justify-between py-2">
							<span class="text-neutral-400 text-base">Due date</span>
							<input
								type="date"
								bind:value={newTodoDueDate}
								class="bg-neutral-800 border-none rounded-xl px-4 py-2 text-sm text-neutral-300 focus:bg-neutral-700 focus:outline-none transition-colors duration-200 inset-depth"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</main>
