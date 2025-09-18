CREATE TABLE "todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"due_date" timestamp DEFAULT NULL
);
