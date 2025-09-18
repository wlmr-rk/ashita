import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "$env/dynamic/private";

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// extend global type for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var __drizzleClient: ReturnType<typeof postgres> | undefined;
}

const client =
  globalThis.__drizzleClient ??
  postgres(env.DATABASE_URL, {
    max: 1,
    prepare: false,
  });

export const db = drizzle(client, { schema });

if (process.env.NODE_ENV !== "production") {
  globalThis.__drizzleClient = client;
}
