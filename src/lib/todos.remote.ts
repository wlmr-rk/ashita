import { query, command } from '$app/server';
import { db } from '$lib/server/db';
import { todos } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const getTodos = query(async () => {
	return await db.select().from(todos).orderBy(todos.completed, desc(todos.createdAt));
});

export const addTodo = command('unchecked', async (data: {
	text: string;
	isHabit?: boolean;
	dueDate?: string;
}) => {
	if (!data.text?.trim()) {
		throw new Error('Text is required');
	}

	const [newTodo] = await db.insert(todos).values({
		text: data.text.trim(),
		completed: false,
		isHabit: data.isHabit || false,
		dueDate: data.dueDate ? new Date(data.dueDate) : null,
	}).returning();
	
	return newTodo;
});

export const updateTodo = command('unchecked', async (data: {
	id: number;
	text?: string;
	completed?: boolean;
	isHabit?: boolean;
	dueDate?: string | null;
}) => {
	const updates: any = {};
	
	if (data.text !== undefined) updates.text = data.text.trim();
	if (data.completed !== undefined) updates.completed = data.completed;
	if (data.isHabit !== undefined) updates.isHabit = data.isHabit;
	if (data.dueDate !== undefined) {
		updates.dueDate = data.dueDate ? new Date(data.dueDate) : null;
	}

	const [updatedTodo] = await db
		.update(todos)
		.set(updates)
		.where(eq(todos.id, data.id))
		.returning();

	if (!updatedTodo) {
		throw new Error('Todo not found');
	}
	
	return updatedTodo;
});

export const deleteTodo = command('unchecked', async (id: number) => {
	const [deletedTodo] = await db
		.delete(todos)
		.where(eq(todos.id, id))
		.returning();

	if (!deletedTodo) {
		throw new Error('Todo not found');
	}
	
	return { success: true };
});