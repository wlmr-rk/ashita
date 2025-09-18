import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  completed: boolean("completed").default(false).notNull(),
  isHabit: boolean("is_habit").default(false).notNull(),
  dueDate: timestamp("due_date", { withTimezone: false }),
  createdAt: timestamp("created_at", { withTimezone: false }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});
